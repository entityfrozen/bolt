// Platform roles are intentionally separate from community display roles.
export const ROLE_OPTIONS=[
 {id:"user",label:"Member",description:"Regular Lightning account."},
 {id:"support_agent",label:"Support Agent",description:"View account status and help users; cannot change accounts."},
 {id:"moderator",label:"Moderator",description:"Remove inappropriate community and social chat messages."},
 {id:"community_manager",label:"Community Manager",description:"Manage channels, community roles and moderation."},
 {id:"account_manager",label:"Account Manager",description:"Approve, create and maintain regular accounts, not staff."},
 {id:"admin",label:"Administrator",description:"Full platform access, including staff roles and global controls."}
];
const grants={
 user:[],
 support_agent:["staff.access","accounts.read"],
 moderator:["staff.access","community.moderate"],
 community_manager:["staff.access","community.manage","community.moderate"],
 account_manager:["staff.access","accounts.read","accounts.manage"],
 admin:["staff.access","accounts.read","accounts.manage","roles.assign","community.manage","community.moderate","settings.manage","sessions.read","sessions.manage","audit.read"]
};
export const isValidRole=role=>Object.hasOwn(grants,role);
export const hasPermission=(role,permission)=>(grants[role]||[]).includes(permission);
export const permissionsFor=role=>[...(grants[role]||[])];
export const canManageAccount=(actor,target)=>hasPermission(actor?.role,"accounts.manage")&&
 (actor.role==="admin"||(target?.role==="user"&&actor.id!==target?.id));
