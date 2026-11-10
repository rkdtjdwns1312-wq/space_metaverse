export const ARCHIVE_KINDS=Object.freeze(['diary','reading']);
export const ARCHIVE_LIMITS=Object.freeze({title:100,body:10000,bookTitle:160,author:100,reply:500,pageSize:20,entriesPerKind:1000});
export const archiveReplyUnread=entry=>!!entry?.reply&&(entry.replySeenVersion||0)<(entry.reply.version||1);
export const hasUnreadArchiveReplies=archive=>ARCHIVE_KINDS.some(kind=>(archive?.[kind]||[]).some(archiveReplyUnread));
