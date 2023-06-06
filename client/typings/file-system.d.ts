import * as FileSystem from 'expo-file-system';

declare module 'expo-file-system' {
  export interface FileSystem extends FileSystem {
    appendAsStringAsync: (
      fileUri: string,
      contents: string,
      options?: FileSystem.WritingOptions
    ) => Promise<void>;
  }
}