import {randomInt, randomUUID} from 'node:crypto';
import {
  link,
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import {STATUS_LIST_ENTRY_COUNT} from '../constants.js';

const INDEX_FILE_PATTERN = /^(0|[1-9][0-9]{0,5})\.json$/;

interface AssignmentRecord {
  credentialId: string;
  statusListIndex: number;
}

export interface RevocationResult {
  statusListIndex: number;
  alreadyRevoked: boolean;
}

export class FileStatusListStore {
  private readonly assignmentsDirectory: string;
  private readonly revocationsDirectory: string;

  constructor(
    rootDirectory: string,
    private readonly indexGenerator: () => number = () =>
      randomInt(STATUS_LIST_ENTRY_COUNT)
  ) {
    this.assignmentsDirectory = path.join(rootDirectory, 'assignments');
    this.revocationsDirectory = path.join(rootDirectory, 'revocations');
  }

  async reserve(credentialId: string): Promise<number> {
    await mkdir(this.assignmentsDirectory, {recursive: true});
    for(let attempt = 0; attempt < STATUS_LIST_ENTRY_COUNT; ++attempt) {
      const index = this.indexGenerator();
      assertIndex(index);
      const destination = this.assignmentPath(index);
      const record: AssignmentRecord = {
        credentialId,
        statusListIndex: index
      };
      try {
        await writeExclusiveJson(destination, record);
        return index;
      } catch(error) {
        if(isAlreadyExists(error)) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('The status list has no unassigned entries.');
  }

  async revoke(
    credentialId: string,
    statusListIndex: number
  ): Promise<RevocationResult> {
    assertIndex(statusListIndex);
    const assignment = await this.readAssignment(statusListIndex);
    if(assignment.credentialId !== credentialId) {
      throw new Error('Credential does not own the requested status index.');
    }

    await mkdir(this.revocationsDirectory, {recursive: true});
    try {
      await writeExclusiveJson(this.revocationPath(statusListIndex), {
        credentialId,
        statusListIndex,
        revokedAt: new Date().toISOString()
      });
      return {statusListIndex, alreadyRevoked: false};
    } catch(error) {
      if(isAlreadyExists(error)) {
        return {statusListIndex, alreadyRevoked: true};
      }
      throw error;
    }
  }

  async isRevoked(statusListIndex: number): Promise<boolean> {
    assertIndex(statusListIndex);
    try {
      await readFile(this.revocationPath(statusListIndex), 'utf8');
      return true;
    } catch(error) {
      if(isNotFound(error)) {
        return false;
      }
      throw error;
    }
  }

  async revokedIndices(): Promise<number[]> {
    try {
      const entries = await readdir(this.revocationsDirectory);
      return entries.flatMap(fileName => {
        const match = INDEX_FILE_PATTERN.exec(fileName);
        if(!match?.[1]) {
          return [];
        }
        const index = Number.parseInt(match[1], 10);
        return index < STATUS_LIST_ENTRY_COUNT ? [index] : [];
      });
    } catch(error) {
      if(isNotFound(error)) {
        return [];
      }
      throw error;
    }
  }

  private async readAssignment(index: number): Promise<AssignmentRecord> {
    const raw = await readFile(this.assignmentPath(index), 'utf8');
    const value = JSON.parse(raw) as Partial<AssignmentRecord>;
    if(typeof value.credentialId !== 'string' ||
      value.statusListIndex !== index) {
      throw new Error('Stored status-list assignment is invalid.');
    }
    return value as AssignmentRecord;
  }

  private assignmentPath(index: number): string {
    return path.join(this.assignmentsDirectory, `${index}.json`);
  }

  private revocationPath(index: number): string {
    return path.join(this.revocationsDirectory, `${index}.json`);
  }
}

async function writeExclusiveJson(
  destination: string,
  value: unknown
): Promise<void> {
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value)}\n`, {
      encoding: 'utf8',
      flag: 'wx'
    });
    // Linking a complete temporary file is atomic and refuses replacement.
    await link(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

function assertIndex(index: number): void {
  if(!Number.isInteger(index) || index < 0 ||
    index >= STATUS_LIST_ENTRY_COUNT) {
    throw new Error('Status-list index is outside the supported range.');
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}
