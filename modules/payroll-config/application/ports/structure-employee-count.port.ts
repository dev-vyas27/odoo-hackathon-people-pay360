

export interface StructureEmployeeCountPort {
  
  countByStructure(structureIds: string[]): Promise<Map<string, number>>
}
