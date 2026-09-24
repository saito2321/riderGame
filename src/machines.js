export const MACHINES = Object.freeze([
  { id: 'street', nameKey: 'machine.street', unlockScore: 0 },
  { id: 'scooter', nameKey: 'machine.scooter', unlockScore: 5000 },
  { id: 'supersport', nameKey: 'machine.supersport', unlockScore: 10000 },
  { id: 'horse', nameKey: 'machine.horse', unlockScore: 20000 },
  { id: 'robovac', nameKey: 'machine.robovac', unlockScore: 30000 }
]);

export const DEFAULT_MACHINE_ID = MACHINES[0].id;
export const machineById = id => MACHINES.find(machine => machine.id === id);
export const isMachineUnlocked = (id, bestScore, adUnlockedMachines = []) => {
  const machine = machineById(id);
  return Boolean(machine && (bestScore >= machine.unlockScore || adUnlockedMachines.includes(id)));
};
