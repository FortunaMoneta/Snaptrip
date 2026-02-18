
import Dexie, { type EntityTable } from 'dexie';
import { Trip, ScannedReceipt } from '../types';

// Define the database
const db = new Dexie('SnapTripDB') as Dexie & {
  trips: EntityTable<Trip, 'id'>;
};

// Define schema
db.version(1).stores({
  trips: 'id, title, startDate, endDate' // Primary key and indexed props
});

// Helper to get all trips
export const getTrips = async (): Promise<Trip[]> => {
  return await db.trips.toArray();
};

// Helper to save a trip (create or update)
export const saveTrip = async (trip: Trip) => {
  await db.trips.put(trip);
};

// Helper to delete a trip
export const deleteTrip = async (id: string) => {
  await db.trips.delete(id);
};

// Helper to migrate from localStorage
export const migrateFromLocalStorage = async () => {
  const savedTrips = localStorage.getItem('travel_admin_sorter_trips');
  if (savedTrips) {
    try {
      const parsedTrips: Trip[] = JSON.parse(savedTrips);
      if (parsedTrips.length > 0) {
        // Check if DB is empty before migrating to avoid duplicates/overwrites
        const count = await db.trips.count();
        if (count === 0) {
          console.log('Migrating data from localStorage to IndexedDB...');
          await db.trips.bulkPut(parsedTrips);
          console.log('Migration complete.');
        }
      }
    } catch (e) {
      console.error('Failed to migrate trips from localStorage', e);
    }
  }
};

export { db };
