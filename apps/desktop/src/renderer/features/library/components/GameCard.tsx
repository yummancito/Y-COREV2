/**
 * `GameCard` — una tarjeta de juego en el grid de la biblioteca.
 *
 * Sirve para mostrar el estado (instalado o no) y disparar el lanzamiento.
 * Componente puro respecto a datos: recibe el `game` ya resuelto por
 * `useLibraryQuery`, no hace fetching propio.
 */

interface GameShape {
  readonly appId: number;
  readonly name: string;
  readonly installation: { readonly executablePath: string | null } | null;
}

interface GameCardProps {
  readonly game: GameShape;
  readonly onLaunch: (appId: number) => void;
  readonly isLaunching: boolean;
}

export function GameCard({ game, onLaunch, isLaunching }: GameCardProps): React.JSX.Element {
  const canLaunch = game.installation?.executablePath !== null && game.installation !== null;

  return (
    <article>
      <h3>{game.name}</h3>
      <p>{game.installation === null ? 'No instalado' : 'Instalado'}</p>
      <button
        type="button"
        disabled={!canLaunch || isLaunching}
        onClick={() => onLaunch(game.appId)}
      >
        {isLaunching ? 'Lanzando…' : 'Jugar'}
      </button>
    </article>
  );
}
