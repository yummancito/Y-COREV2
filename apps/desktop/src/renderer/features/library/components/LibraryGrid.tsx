/**
 * `LibraryGrid` — pantalla principal de la feature Biblioteca.
 *
 * Sirve para mostrar todos los juegos conocidos y lanzar uno. Sin
 * virtualización todavía (decisión local, ver docs/02-features/library/
 * decisions.md): con datos reales de Steam (Fase 3) se medirá el costo real
 * de renderizar y se virtualiza entonces con @tanstack/react-virtual, en vez
 * de añadir esa dependencia hoy sin datos que la justifiquen.
 */

import { useLaunchGame } from '../hooks/use-launch-game.js';
import { useLibraryQuery } from '../hooks/use-library-query.js';
import { GameCard } from './GameCard.js';

export function LibraryGrid(): React.JSX.Element {
  const library = useLibraryQuery();
  const launch = useLaunchGame();

  if (library.isPending) return <p>Cargando biblioteca…</p>;
  if (library.isError) return <p>No se pudo cargar la biblioteca: {library.error.message}</p>;

  if (library.data.length === 0) {
    return <p>No hay juegos en la biblioteca todavía.</p>;
  }

  return (
    <div role="grid">
      {library.data.map((game) => (
        <GameCard
          key={game.appId}
          game={game}
          onLaunch={(appId) => launch.mutate(appId)}
          isLaunching={launch.isPending && launch.variables === game.appId}
        />
      ))}
    </div>
  );
}
