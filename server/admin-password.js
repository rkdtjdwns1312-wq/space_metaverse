export function configuredAdminPassword(value) {
  if(typeof value!=='string'||value.length<12||value.startsWith('replace-'))
    throw new Error('Set a private ADMIN_PASSWORD of at least 12 characters in .env.');
  return value;
}
