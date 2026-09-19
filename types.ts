
export interface SVGAFileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  url: string;
}

export interface SVGAFileExtended extends SVGAFileInfo {
  rawFile: File;
}

export enum PlayerStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR'
}
