import { hash32 } from "../engine/rng";
import { historyPack, peoplePack } from "../helpers/characters";
import { isPersonUnlocked } from "../content/personUnlocks";
import type { Save } from "../save/schema";

export const DAILY_REWARD_TARGET = 40;
export const DAILY_COMPLETE_COLLECTION_STARS = 5;
export const dailyRewardClaimed = (save: Save, date: string) => Object.prototype.hasOwnProperty.call(save.dailyRewards, date);

// One new locked portrait per day. Stable for the same date and collection.
export function dailyRewardPerson(save: Save, date: string) {
  const people = [...historyPack, ...peoplePack];
  if (dailyRewardClaimed(save, date)) return people.find(person => person.name === save.dailyRewards[date]) ?? null;
  const locked = people.filter(person => !isPersonUnlocked(save, person.name));
  return locked.length ? locked[hash32("daily-portrait", date) % locked.length] : null;
}
