import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface UserSettings {
  defaultSheetUrl?: string; // CSV 또는 Google Sheets publish-to-web CSV URL
  savedSheets?: { id: string; name: string; url: string }[]; // 사용자가 저장한 시트 목록
  // 시트별 카드 디자인 설정 (키: sheetUrl)
  cardConfigs?: { [sheetUrl: string]: CardConfig };
}

// 카드 템플릿 유형
export type CardTemplateType = 'default' | 'custom' | 'calendar';

// 개별 필드를 어떤 영역에 배치할지 정의
export interface CardFieldMapping {
  // 페이지 헤더 제목
  headerTitle?: string;
  // 단일 필드: 제목만 유지
  title?: string;
  titleStyle?: { color?: string; size?: 1 | 2 | 3 | 4 | 5 };
  // 그룹 리스트: 텍스트/데이터 항목과 스타일 포함
  groups?: Array<{
    label?: string; // 그룹 제목
    borderColor?: string; // 그룹 테두리 색상
    items: Array<
      | { type: 'text'; text: string; color?: string; size?: 1 | 2 | 3 | 4 | 5 }
      | { type: 'data'; field: string; prefix?: string; suffix?: string; color?: string; size?: 1 | 2 | 3 | 4 | 5 }
    >;
  }>;
  // 필터 매핑: 기간(시작일 컬럼), 작성자 컬럼
  filterMapping?: {
    startDateField?: string; // 기간 선택 시 시작일로 사용할 컬럼명
    authorField?: string; // 작성자 필터로 사용할 컬럼명
  };
  // 달력 매핑: 달력 이벤트 생성을 위한 필드 매핑
  calendarMapping?: {
    startDateField: string; // 필수: 시작일 컬럼명 (YYYY-MM-DD)
    endDateField?: string;  // 선택: 종료일 컬럼명
    authorField?: string;   // 선택: 작성자 컬럼명
    contentField: string;   // 필수: 이벤트 내용으로 쓸 컬럼명
    typeLabel?: string;     // 선택: 내용 앞에 붙일 라벨 (예: "출장")
  };
}

export interface CardConfig {
  template: CardTemplateType;
  fields: CardFieldMapping;
}

const collectionName = 'userSettings';

export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
  const ref = doc(db, collectionName, userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserSettings;
};

export const upsertUserSettings = async (userId: string, settings: Partial<UserSettings>): Promise<void> => {
  const ref = doc(db, collectionName, userId);
  const prevSnap = await getDoc(ref);
  const prevData = (prevSnap.exists() ? (prevSnap.data() as UserSettings) : {}) as UserSettings;

  // 깊은 병합: cardConfigs는 키별(시트+모드)로 덮어쓰지 않고 병합
  const merged: UserSettings = {
    ...prevData,
    ...settings,
    cardConfigs: {
      ...(prevData.cardConfigs || {}),
      ...(settings.cardConfigs || {}),
    },
  };

  await setDoc(ref, merged, { merge: true });
};


