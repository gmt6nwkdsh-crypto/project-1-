// Daily quotes, oldest to newest. Everyone gets the same quote on the same day.
// Kept to quotes with a known source; "via" notes when the famous version is someone else's wording.
export const QUOTES = [
  ['The journey of a thousand miles begins with a single step.', 'Lao Tzu', 'Tao Te Ching, c. 400 BC'],
  ['Knowing others is intelligence; knowing yourself is true wisdom.', 'Lao Tzu', 'Tao Te Ching, c. 400 BC'],
  ['Go to the ant, thou sluggard; consider her ways, and be wise.', 'Book of Proverbs', '6:6'],
  ['Dripping water hollows out a stone.', 'Ovid', 'c. 10 AD'],
  ['While we are postponing, life speeds by.', 'Seneca', 'Letters, c. 65 AD'],
  ['No man is free who is not master of himself.', 'Epictetus', 'c. 100 AD'],
  ['First say to yourself what you would be; and then do what you have to do.', 'Epictetus', 'Discourses, c. 108 AD'],
  ['The impediment to action advances action. What stands in the way becomes the way.', 'Marcus Aurelius', 'Meditations, c. 170 AD'],
  ['Waste no more time arguing what a good man should be. Be one.', 'Marcus Aurelius', 'Meditations, c. 170 AD'],
  ['Fall seven times, stand up eight.', 'Japanese proverb', ''],
  ['Well done is better than well said.', 'Benjamin Franklin', 'Poor Richard’s Almanack, 1737'],
  ['Lost time is never found again.', 'Benjamin Franklin', 'Poor Richard’s Almanack, 1748'],
  ['Knowing is not enough; we must apply. Willing is not enough; we must do.', 'Johann Wolfgang von Goethe', '1829'],
  ['If one advances confidently in the direction of his dreams, he will meet with a success unexpected in common hours.', 'Henry David Thoreau', 'Walden, 1854'],
  ['If there is no struggle, there is no progress.', 'Frederick Douglass', '1857'],
  ['Success is to be measured not so much by the position that one has reached in life as by the obstacles which he has overcome.', 'Booker T. Washington', 'Up from Slavery, 1901'],
  ['Genius is one percent inspiration and ninety-nine percent perspiration.', 'Thomas Edison', 'c. 1903'],
  ['Do what you can, with what you have, where you are.', 'Squire Bill Widener', 'via Theodore Roosevelt, 1913'],
  ['We are what we repeatedly do. Excellence, then, is not an act, but a habit.', 'Will Durant', 'summing up Aristotle, 1926'],
  ['Life is like riding a bicycle. To keep your balance you must keep moving.', 'Albert Einstein', 'letter to his son, 1930'],
  ['Nothing in life is to be feared, it is only to be understood.', 'Marie Curie', ''],
  ['You must do the thing you think you cannot do.', 'Eleanor Roosevelt', 'You Learn by Living, 1960'],
  ['Tell no lies, claim no easy victories.', 'Amílcar Cabral', '1965'],
  ['If you can’t fly then run, if you can’t run then walk, if you can’t walk then crawl, but whatever you do you have to keep moving forward.', 'Martin Luther King Jr.', '1967'],
  ['A life is not important except in the impact it has on other lives.', 'Jackie Robinson', ''],
  ['To give anything less than your best is to sacrifice the gift.', 'Steve Prefontaine', '1970s'],
  ['The last three or four reps is what makes the muscle grow.', 'Arnold Schwarzenegger', 'Pumping Iron, 1977'],
  ['Discipline is the bridge between goals and accomplishment.', 'Jim Rohn', ''],
  ['Start where you are. Use what you have. Do what you can.', 'Arthur Ashe', ''],
  ['Champions keep playing until they get it right.', 'Billie Jean King', ''],
  ['I’ve failed over and over and over again in my life. And that is why I succeed.', 'Michael Jordan', '1997'],
  ['Light weight, baby!', 'Ronnie Coleman', '2000s'],
  ['Hard work beats talent when talent doesn’t work hard.', 'Tim Notke', 'high school basketball coach'],
  ['We may encounter many defeats but we must not be defeated.', 'Maya Angelou', ''],
  ['Success isn’t always about greatness. It’s about consistency.', 'Dwayne Johnson', '2010s'],
  ['I’m not the next Usain Bolt or Michael Phelps. I’m the first Simone Biles.', 'Simone Biles', '2016'],
  ['You do not rise to the level of your goals. You fall to the level of your systems.', 'James Clear', 'Atomic Habits, 2018'],
  ['Only the disciplined ones in life are free.', 'Eliud Kipchoge', '2019'],
  ['No human is limited.', 'Eliud Kipchoge', 'after the first sub-2-hour marathon, 2019'],
  ['Every action you take is a vote for the type of person you wish to become.', 'James Clear', 'Atomic Habits, 2018']
];

const DAY0 = Date.UTC(2026, 0, 1);
// day: 'YYYY-MM-DD'. Steps through the list in a shuffled order so neighbors in history don't come back to back.
export function quoteFor(day) {
  const [y, m, d] = day.split('-').map(Number);
  const n = Math.round((Date.UTC(y, m - 1, d) - DAY0) / 864e5);
  const L = QUOTES.length, gcd = (a, b) => b ? gcd(b, a % b) : a;
  let step = Math.max(1, Math.round(L * 0.43)); while (gcd(step, L) !== 1) step++; // coprime step: every quote comes up once per cycle
  const i = (((n * step) % L) + L) % L;
  const [text, who, when] = QUOTES[i];
  return { text, who, when };
}
