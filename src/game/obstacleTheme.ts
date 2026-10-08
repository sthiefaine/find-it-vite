const image = (id: string) => `/assets/images/obstacles/${id}.png`;

const ANIMAL_OBSTACLES = {
  concealment: [{ label: "feuillage", imageSrc: image("foliage") }],
  passers: [image("seagull")],
};
const POLITICAL_OBSTACLES = {
  concealment: [
    { label: "avocat", imageSrc: image("politics-lawyer") },
    { label: "CRS", imageSrc: image("politics-crs") },
  ],
  passers: [image("politics-crs"), image("politics-police"), image("politics-yellow-vest")],
};

export const obstacleTheme = (political: boolean) => political ? POLITICAL_OBSTACLES : ANIMAL_OBSTACLES;
