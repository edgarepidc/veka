import { redirect } from 'next/navigation';

export default function PerfilConfigRedirectPage() {
  redirect('/configuracion?tab=perfil');
}
