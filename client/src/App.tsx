import { Celular } from './paginas/Celular';
import { Pc } from './paginas/Pc';

// Duas páginas só: não vale a pena um roteador.
export function App() {
  return window.location.pathname === '/pc' ? <Pc /> : <Celular />;
}
