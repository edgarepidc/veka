import { redirect } from 'next/navigation';

export default function InvitacionesConfigRedirectPage() {
  redirect('/configuracion?tab=unidades');
}
