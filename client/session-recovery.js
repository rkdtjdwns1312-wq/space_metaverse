// A transport failure does not invalidate a classroom token. In particular,
// Socket.IO rejects pending acknowledgements when that socket disconnects.
export function sessionRecoveryAction(error,{connected,id,attemptId}){
  if(!connected)return 'wait';
  if(id!==attemptId)return 'resume';
  if(error?.retryable===true)return 'retry';
  if(error?.message==='operation has timed out'||error?.message==='socket has been disconnected')return 'reconnect';
  return 'reset';
}
