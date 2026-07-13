import { redirect } from 'next/navigation';

export default function CondominioConfigRedirectPage() {
  redirect('/configuracion?tab=perfil');
}
