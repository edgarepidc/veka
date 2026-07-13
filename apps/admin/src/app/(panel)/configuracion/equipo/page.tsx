import { redirect } from 'next/navigation';

export default function EquipoConfigRedirectPage() {
  redirect('/configuracion?tab=equipo');
}
