// The managed classroom asks for one name/PIN row per student. Older test
// servers without managed accounts still use the nickname allowlist field.
export async function fillNewClass(page,names,{pin='1234'}={}){
  const list=Array.isArray(names)?names:names.split(',').map(name=>name.trim()).filter(Boolean);
  // Existing integration fixtures still create classrooms; the public teacher
  // entrance now shows only the administrator-provisioned classroom flow.
  await page.locator('#choose-new-class').evaluate(button=>button.click());
  await page.waitForFunction(()=>!!document.body.dataset.accountMode);
  if(await page.locator('#student-setup-fields').isVisible()){
    await page.locator('#student-count').fill(String(list.length));
    await page.locator('.student-account-row').last().waitFor({state:'visible'});
    for(let index=0;index<list.length;index++){
      await page.locator('.student-account-name').nth(index).fill(list[index]);
      await page.locator('.student-account-pin').nth(index).fill(Array.isArray(pin)?pin[index]:pin);
    }
  }else await page.locator('#allowed-names').fill(list.join(', '));
}
