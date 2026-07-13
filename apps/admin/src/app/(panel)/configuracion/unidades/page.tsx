import { redirect } from 'next/navigation';

export default function UnidadesConfigRedirectPage() {
  redirect('/configuracion?tab=unidades');
}
