export interface DescriptionOperationInterface {
    type: 'insert' | 'delete';
    position: number;
    text?: string;
    length?: number; 
    revision?: number; 
    userId?: number;
    userUuid?: string;
    opId?: string;
}