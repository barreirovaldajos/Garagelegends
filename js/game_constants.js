// game_constants.js
// Centralización de enums y constantes clave para el juego
// Fase 1: Unificación de estados de carrera y otros enums

const RACE_STATUS = Object.freeze({
  UPCOMING: 'upcoming',
  NEXT: 'next',
  COMPLETED: 'completed',
});

// Otros enums y constantes a centralizar en siguientes fases

if (typeof window !== 'undefined') {
  window.RACE_STATUS = RACE_STATUS;
}