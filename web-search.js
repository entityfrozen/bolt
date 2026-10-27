// Only trusted search services are contacted. We never fetch a URL supplied
// by the model or by search results.
const BING = "https://www.bing.com/search";
const BRAVE = "https://api.search.brave.com/res/v1/web/search";
const TAVILY = "https://api.tavily.com/search";

function unescapeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) =>
      String.fromCodePoint(code.toLowerCase().startsWith("x") ? parseInt(code.slice(1), 16) : Number(code)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) =>
      ({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"}[entity]))
    .replace(/\s+/g, " ").trim();
}

function validLink(link) {
  try {
    const url = new URL(link);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname.includes(".")) return null;
    if (["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

export function parseBingRss(xml) {
  const entries = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const item = match[1];
    const field = tag => unescapeXml(item.match(new RegExp("<" + tag + ">([\\s\\S]*?)</" + tag + ">","i"))?.[1] || "");
    const url = validLink(field("link"));
    if (!url) continue;
    const title = field("title").slice(0, 180);
    if (!title) continue;
    entries.push({title, url, snippet:field("description").slice(0, 600)});
  }
  return entries.slice(0, 6);
}

async function responseText(response, maxBytes) {
  if (!response.ok) throw new Error("Search provider returned " + response.status);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > maxBytes) throw new Error("Search response too large");
  const reader = response.body?.getReader();
  if (!reader) return (await response.text()).slice(0, maxBytes);
  let total = 0, parts = [];
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("Search response too large");
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  return new TextDecoder().decode(
    Uint8Array.from(parts.flatMap(bytes => [...bytes]))
  );
}


async function tavily(query, fetcher, key) {
  const response = await fetcher(TAVILY, {
    method: "POST",
    headers: {"Authorization": "Bearer " + key, "Content-Type": "application/json", "Accept": "application/json"},
    body: JSON.stringify({query, search_depth: "basic", max_results: 6, include_answer: false, include_raw_content: false}),
    signal: AbortSignal.timeout(7000)
  });
  const json = JSON.parse(await responseText(response, 450000));
  return (Array.isArray(json.results) ? json.results : []).slice(0, 6).map(result => ({
    title: String(result.title || "").replace(/<[^>]+>/g, "").slice(0, 180),
    url: validLink(result.url),
    snippet: String(result.content || "").replace(/<[^>]+>/g, "").slice(0, 600)
  })).filter(item => item.title && item.url);
}

async function brave(query, fetcher, key) {
  const url = new URL(BRAVE);
  url.searchParams.set("q", query);
  url.searchParams.set("count", "6");
  const response = await fetcher(url, {
    headers:{"Accept":"application/json","X-Subscription-Token":key},
    signal:AbortSignal.timeout(7000)
  });
  const json = JSON.parse(await responseText(response, 450000));
  return (json.web?.results || []).slice(0, 6).map(result => ({
    title:String(result.title || "").replace(/<[^>]+>/g, "").slice(0, 180),
    url:validLink(result.url),
    snippet:String(result.description || "").replace(/<[^>]+>/g, "").slice(0, 600)
  })).filter(item => item.url && item.title);
}

async function bing(query, fetcher) {
  const url = new URL(BING);
  url.searchParams.set("format", "rss");
  url.searchParams.set("q", query);
  const response = await fetcher(url, {
    headers:{"Accept":"application/rss+xml, application/xml;q=0.9, text/xml;q=0.8"},
    signal:AbortSignal.timeout(7000)
  });
  return parseBingRss(await responseText(response, 300000));
}

async function googleNews(query, fetcher) {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query + " when:7d");
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  const response = await fetcher(url, {
    headers:{"Accept":"application/rss+xml"},
    signal:AbortSignal.timeout(7000)
  });
  return parseBingRss(await responseText(response, 300000));
}

async function wikipedia(query, fetcher) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("srlimit", "5");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const response = await fetcher(url, {
    headers:{"Accept":"application/json"},
    signal:AbortSignal.timeout(7000)
  });
  const data = JSON.parse(await responseText(response, 200000));
  return (data.query?.search || []).slice(0, 5).map(item => ({
    title:String(item.title || "").slice(0, 180),
    url:"https://en.wikipedia.org/?curid=" + Number(item.pageid),
    snippet:String(item.snippet || "").replace(/<[^>]*>/g, "").slice(0, 600)
  })).filter(item => item.title && Number.isSafeInteger(Number(new URL(item.url).searchParams.get("curid"))));
}

export function needsWebSearch(message) {
  const text = String(message || "").trim();
  if (!text) return false;
  return /\b(websearch|web.search|search (the )?(web|internet|online|for)|can you search|could you search|look (it )?up|browse|google|sources?|citation|latest|current|recent|today|yesterday|this week|breaking|news|weather|price|stock price|as of now|2026)\b/i.test(text);
}

export async function searchWeb(query, {fetcher=fetch, braveKey=process.env.BRAVE_SEARCH_API_KEY, tavilyKey=process.env.TAVILY_API_KEY, providerOnly=null}={}) {
  const text = String(query || "").replace(/\s+/g, " ").trim().slice(0, 180);
  if (!text) return {sources:[],provider:null,error:"No search query provided."};
  const providers = tavilyKey ? [["Tavily",()=>tavily(text,fetcher,tavilyKey)]] : [];
  if (braveKey) providers.push(["Brave",()=>brave(text,fetcher,braveKey)]);
  if(providerOnly){
    const selection=providerOnly==="tavily"?"Tavily":providerOnly==="brave"?"Brave":null;
    if(!selection)return {sources:[],provider:null,error:"Unknown search provider."};
    const chosen=providers.find(([name])=>name===selection);
    if(!chosen)return {sources:[],provider:null,error:selection+" key is not configured."};
    try{
      const sources=await chosen[1]();
      return {sources,provider:selection,error:sources.length?null:selection+" returned no usable search results."};
    }catch(error){
      return {sources:[],provider:selection,error:selection+" test failed: "+String(error?.message||"Provider unavailable").slice(0,100)};
    }
  }
  providers.push(["Bing",()=>bing(text,fetcher)]);
  if (/\b(news|latest|today|breaking|this week|recent|current)\b/i.test(text)) {
    providers.push(["Google News",()=>googleNews(text,fetcher)]);
  }
  // Wikipedia is a narrower fallback, not a substitute for recent news.
  if (!/\b(latest|today|news|breaking|this week|price|weather|current)\b/i.test(text)) {
    providers.push(["Wikipedia",()=>wikipedia(text,fetcher)]);
  }
  for (const [provider, run] of providers) {
    try {
      const sources = await run();
      if (sources.length) return {sources,provider,error:null};
    } catch (err) {
      console.warn("Lightning search:",provider,err?.message||"request failed");
    }
  }
  return {sources:[],provider:null,error:"Live web search is temporarily unavailable. No current sources could be verified."};
}
