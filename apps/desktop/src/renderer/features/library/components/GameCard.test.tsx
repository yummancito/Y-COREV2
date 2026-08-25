import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameCard } from './GameCard.js';

describe('GameCard', () => {
  it('muestra "No instalado" y deshabilita el botón cuando el juego no está instalado', () => {
    render(<GameCard game={{ appId: 1, name: 'Juego', installation: null }} onLaunch={vi.fn()} isLaunching={false} />);

    expect(screen.getByText('No instalado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jugar' })).toBeDisabled();
  });

  it('muestra "Instalado" y habilita el botón cuando hay executablePath resuelto', () => {
    render(
      <GameCard
        game={{ appId: 1, name: 'Juego', installation: { executablePath: 'C:\\juego.exe' } }}
        onLaunch={vi.fn()}
        isLaunching={false}
      />,
    );

    expect(screen.getByText('Instalado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jugar' })).toBeEnabled();
  });

  it('deshabilita el botón si está instalado pero sin executablePath resuelto', () => {
    render(
      <GameCard
        game={{ appId: 1, name: 'Juego', installation: { executablePath: null } }}
        onLaunch={vi.fn()}
        isLaunching={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Jugar' })).toBeDisabled();
  });

  it('clic en Jugar llama a onLaunch con el appId', async () => {
    const onLaunch = vi.fn();
    render(
      <GameCard
        game={{ appId: 730, name: 'Counter-Strike 2', installation: { executablePath: 'cs2.exe' } }}
        onLaunch={onLaunch}
        isLaunching={false}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Jugar' }));
    expect(onLaunch).toHaveBeenCalledWith(730);
  });

  it('muestra "Lanzando…" mientras isLaunching es true', () => {
    render(
      <GameCard
        game={{ appId: 730, name: 'Counter-Strike 2', installation: { executablePath: 'cs2.exe' } }}
        onLaunch={vi.fn()}
        isLaunching={true}
      />,
    );

    expect(screen.getByRole('button', { name: 'Lanzando…' })).toBeInTheDocument();
  });
});
