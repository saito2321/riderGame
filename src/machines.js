export const MACHINES = Object.freeze([
  { id: 'street', nameKey: 'machine.street', unlockScore: 0 },
  { id: 'scooter', nameKey: 'machine.scooter', unlockScore: 5000 },
  { id: 'racer', nameKey: 'machine.racer', unlockScore: 12000 },
  { id: 'cyber', nameKey: 'machine.cyber', unlockScore: 25000 },
  { id: 'phantom', nameKey: 'machine.phantom', unlockScore: 40000 }
]);

export const DEFAULT_MACHINE_ID = MACHINES[0].id;
export const machineById = id => MACHINES.find(machine => machine.id === id);
export const isMachineUnlocked = (id, bestScore) => {
  const machine = machineById(id);
  return Boolean(machine && bestScore >= machine.unlockScore);
};
