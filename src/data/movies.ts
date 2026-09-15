export type Movie = {
  id: string;
  title: string;
  year: number;
  genre: string;
  poster: string;
  backdrop: string;
  description: string;
  embed: string;
  featured?: boolean;
};

export const movies: Movie[] = [
  {
    id: 'featured-cinema',
    title: 'Featured Cinema',
    year: 2026,
    genre: 'Featured',
    poster:
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=85',
    backdrop:
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1800&q=85',
    description:
      'Your first featured movie will appear here. Add movies through the private REBELVAULT control panel.',
    embed: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    featured: true,
  },
];
