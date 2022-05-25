import { Note, NoteGenInput, ProvingManagerSetupInput, ProvingManagerWrapper } from '@webb-tools/sdk-core';

async function generateNote(): Promise<Note> {
  const noteInput: NoteGenInput = {
    protocol: 'mixer',
    version: 'v2',
    sourceChain: '5',
    targetChain: '5',
    sourceIdentifyingData: '3',
    targetIdentifyingData: '3',
    tokenSymbol: 'WEBB',
    amount: '1',
    denomination: '18',
    backend: 'Arkworks',
    hashFunction: 'Poseidon',
    curve: 'Bn254',
    width: '3',
    exponentiation: '5',
  };
  const note = await Note.generateNote(noteInput);
  return note
}

async function main() {
  const note = await generateNote();
  const commitment = note.getLeaf();

  console.log(commitment);
}

main();