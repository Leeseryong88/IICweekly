export interface SheetRow {
  [key: string]: string;
  '시작일': string;
  '종료일': string;
  '핵심과제(진행경과)': string;
  '핵심과제(예정)': string;
  '주요일정': string;
  '이슈': string;
  '출장(시작일)': string;
  '출장(종료일)': string;
  '출장내용': string;
  '작성자': string;
}

export enum MessageSender {
  USER = 'user',
  AI = 'ai',
  SYSTEM = 'system',
}

export interface ChatMessage {
  sender: MessageSender;
  text: string;
}

export interface VisibleFields {
  period: boolean;
  inProgressTask: boolean;
  plannedTask: boolean;
  mainSchedule: boolean;
  issue: boolean;
  businessTrip: boolean;
}
