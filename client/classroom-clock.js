const partsFormatter=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',weekday:'long',hour:'numeric',minute:'2-digit',hour12:true});

export function formatClassroomTime(date=new Date()){
  const parts=Object.fromEntries(partsFormatter.formatToParts(date).map(part=>[part.type,part.value]));
  return `${parts.year}년 ${parts.month}월 ${parts.day}일 ${parts.weekday} ${parts.dayPeriod} ${parts.hour}:${parts.minute}`;
}

export function startClassroomClock(element){
  const update=()=>{element.textContent=formatClassroomTime();};
  update();
  return setInterval(update,1000);
}
