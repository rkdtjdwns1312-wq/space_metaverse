// Keep controls outside the scroll area without replacing nodes or their handlers.
export function pinDialogHeader(dialog){
  const header=dialog.querySelector(':scope > header');
  if(!header||dialog.classList.contains('fixed-dialog-header'))return;
  const body=document.createElement('div');body.className='dialog-scroll-body';
  for(const node of [...dialog.childNodes])if(node!==header)body.append(node);
  dialog.append(body);dialog.classList.add('fixed-dialog-header');
  dialog.addEventListener('close',()=>{body.scrollTop=0;});
}
