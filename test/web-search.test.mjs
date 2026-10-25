import test from "node:test";
import assert from "node:assert/strict";
import {needsWebSearch, parseBingRss, searchWeb} from "../web-search.js";

const rss = '<?xml version="1.0"?><rss><channel><item><title>Example &amp; guide</title><link>https://example.com/story</link><description>Published this week.</description></item><item><title>Ignored</title><link>javascript:alert(1)</link><description>Unsafe URL</description></item></channel></rss>';

test("Extracts a readable title, snippet and safe link from RSS", () => {
  const sources = parseBingRss(rss);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].title, "Example & guide");
  assert.equal(sources[0].url, "https://example.com/story");
});

test("Recognizes requests that need information from the web", () => {
  assert.equal(needsWebSearch("What's the latest news about OpenFront?"), true);
  assert.equal(needsWebSearch("Search the web for this error"), true);
  assert.equal(needsWebSearch("Can you websearch OpenFront updates?"), true);
  assert.equal(needsWebSearch("Could you search for the latest docs?"), true);
  assert.equal(needsWebSearch("Tell me a short story about a dog"), false);
});

test("Web search accepts evidence from the fixed search endpoint", async () => {
  let searched = "";
  const fetcher = async url => {
    searched = String(url);
    return new Response(rss, {status:200,headers:{"Content-Type":"application/xml"}});
  };
  const result = await searchWeb("latest updates", {fetcher,braveKey:"",tavilyKey:""});
  assert.equal(result.provider, "Bing");
  assert.ok(searched.startsWith("https://www.bing.com/search?"));
  assert.equal(result.sources.length, 1);
});

test("Web search reports an outage rather than inventing citations", async () => {
  const fetcher = async () => { throw new Error("Offline"); };
  const result = await searchWeb("anything", {fetcher,braveKey:"",tavilyKey:""});
  assert.equal(result.sources.length, 0);
  assert.match(result.error, /unavailable/i);
});

test("News searches use a second independent feed when the first is unavailable", async () => {
  const xml = '<rss><channel><item><title>OpenFront updated</title><link>https://example.com/news</link><description>New release</description></item></channel></rss>';
  const fetcher = async url => {
    if (String(url).startsWith("https://www.bing.com")) return new Response("offline", {status:503});
    if (String(url).startsWith("https://news.google.com")) return new Response(xml, {status:200});
    throw new Error("Unexpected provider");
  };
  const result = await searchWeb("latest OpenFront news", {fetcher,braveKey:"",tavilyKey:""});
  assert.equal(result.provider, "Google News");
  assert.equal(result.sources[0].url, "https://example.com/news");
});

test("Tavily's free-tier API uses authenticated, fixed-endpoint searches", async () => {
  let request;
  const fetcher = async (url, options) => {
    request = {url: String(url), ...options};
    return new Response(JSON.stringify({results:[
      {title:"Documentation",url:"https://example.com/docs",content:"Official guide"},
      {title:"Blocked",url:"javascript:alert(1)",content:"Untrusted protocol"}
    ]}), {status:200, headers:{"Content-Type":"application/json"}});
  };
  const result = await searchWeb("search docs", {fetcher,braveKey:"",tavilyKey:"test-key"});
  assert.equal(result.provider,"Tavily");
  assert.deepEqual(result.sources,[{title:"Documentation",url:"https://example.com/docs",snippet:"Official guide"}]);
  assert.equal(request.url,"https://api.tavily.com/search");
  assert.equal(request.method,"POST");
  assert.equal(request.headers.Authorization,"Bearer test-key");
  assert.equal(JSON.parse(request.body).search_depth,"basic");
});

test("If Tavily is down, search continues to the free RSS fallback", async () => {
  const fetcher = async url => String(url).includes("api.tavily.com")
    ? new Response("error",{status:429})
    : new Response(rss,{status:200,headers:{"Content-Type":"application/xml"}});
  const result = await searchWeb("search docs",{fetcher,braveKey:"",tavilyKey:"test-key"});
  assert.equal(result.provider,"Bing");
  assert.equal(result.sources.length,1);
});
