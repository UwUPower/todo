import { DescriptionOperationInterface } from "./interfaces";

export function applyOperation(doc: string, op: DescriptionOperationInterface): string {
    if (op.type === 'insert' && op.text !== undefined) {
      return doc.slice(0, op.position) + op.text + doc.slice(op.position);
    } else if (op.type === 'delete' && op.length !== undefined) {
      return doc.slice(0, op.position) + doc.slice(op.position + op.length);
    }
    return doc;
  }

  export function transformOperation(opA: DescriptionOperationInterface, opB: DescriptionOperationInterface): DescriptionOperationInterface {
    let newOpA = { ...opA };
  
    if (opA.type === 'insert' && opB.type === 'insert') {
      // If both are inserts, and opB is before or at the same position, shift opA's position
      if (opB.position <= opA.position) {
        newOpA.position += opB.text?.length || 0;
      }
    } else if (opA.type === 'delete' && opB.type === 'insert') {
      // If opA is delete and opB is insert, shift opA's position if opB is before it
      if (opB.position <= opA.position) {
        newOpA.position += opB.text?.length || 0;
      }
    } else if (opA.type === 'insert' && opB.type === 'delete') {
      // If opA is insert and opB is delete, shift opA's position if opB is before it
      if (opB.position < opA.position) {
        newOpA.position -= opB.length || 0;
      }
      // If opB deletes where opA would insert, that's a conflict. Simplified: just adjust position.
      if (newOpA.position < 0) newOpA.position = 0; // Prevent negative position
    } else if (opA.type === 'delete' && opB.type === 'delete') {
      // If both are deletes
      if (opB.position < opA.position) {
        newOpA.position -= opB.length || 0;
      }
      // If they overlap, this is more complex. Simplified: just adjust position.
      // A robust OT would handle splitting/merging operations.
      if (newOpA.position < 0) newOpA.position = 0;
    }
    return newOpA;
  }