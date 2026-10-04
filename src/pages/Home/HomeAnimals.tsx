const FRIENDS = [
  { id: "vache", className: "cow" },
  { id: "chat-siamois", className: "cat" },
  { id: "mouton", className: "sheep" },
  { id: "renard", className: "fox" },
  { id: "chien-golden-retriever", className: "dog" },
  { id: "capybara", className: "capybara" },
] as const;

export const HomeAnimals = () => (
  <div
    className="home-animals"
    role="img"
    aria-label="Le capybara et sa bande : une vache, un chat, un mouton, un renard et un chien"
  >
    <svg className="home-animals-decor" viewBox="0 0 400 190" fill="none" aria-hidden="true">
      <ellipse cx="204" cy="109" rx="168" ry="72" fill="#ad71ed" fillOpacity=".12" />
      <path d="M32 119C15 44 121 10 194 20M242 18C320 20 382 66 367 117" stroke="#d9b7ff" strokeOpacity=".3" strokeWidth="2" strokeDasharray="3 9" strokeLinecap="round" />
      <path d="M23 40L26 48L34 51L26 54L23 62L20 54L12 51L20 48Z" fill="#ffdc73" />
      <path d="M374 129L377 136L384 139L377 142L374 149L371 142L364 139L371 136Z" fill="#ffdc73" />
      <path d="M342 23L344 28L349 30L344 32L342 37L340 32L335 30L340 28Z" fill="#f6c3e8" />
      <circle cx="57" cy="18" r="3" fill="#ecacf0" />
      <circle cx="384" cy="71" r="2.5" fill="#ffd674" />
      <circle cx="20" cy="139" r="2.5" fill="#b59bff" />
      <path d="M53 163L60 158M348 164L342 159" stroke="#9ee8d2" strokeWidth="3" strokeLinecap="round" />
    </svg>
    <div className="home-animals-shadow" aria-hidden="true" />
    {FRIENDS.map(({ id, className }) => (
      <div key={id} className={`home-animal home-animal-${className}`} aria-hidden="true">
        <img
          src={`/assets/images/characters/animals/${id}.png`}
          alt=""
          width="512"
          height="512"
          draggable={false}
        />
      </div>
    ))}
  </div>
);
