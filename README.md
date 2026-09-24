# 신임 팀장 온보딩 사이트 (Firebase / Firestore 버전)

## 1. 파일 구조

```
onboarding-site-firebase/
├── index.html          # 팀장용: 사번 로그인 + 온보딩 메인(홈·체크리스트·가이드·담당자)
├── admin.html           # 관리자용: 로그인 + 사번/콘텐츠 관리 + 샘플 데이터 채우기
├── app.js                # index.html 로직 (인증, 실시간 데이터 반영, 체크리스트, 검색)
├── admin.js              # admin.html 로직 (인증, CRUD, 엑셀 업로드, 샘플 데이터 시드)
├── firebaseClient.js      # Firebase 앱/Auth/Firestore 초기화
├── firebaseConfig.js      # Firebase 프로젝트 연결 설정
├── firestore.rules        # Firestore 보안 규칙 (Supabase의 RLS와 같은 역할)
├── firebase.json           # Firebase Hosting/CLI 설정 (선택)
└── README.md
```

Supabase 버전과 화면·기능은 100% 동일하고, 데이터베이스만 Firestore로 바뀌었습니다.
추가로 **관리자가 콘텐츠를 저장하면 팀장 화면이 새로고침 없이 실시간으로 갱신**됩니다 (`onSnapshot` 사용).

## 2. 무료로 배포하기 (Firebase)

### 2-1. Firebase 프로젝트 만들기 (무료 Spark 플랜)

1. https://console.firebase.google.com 접속 → Google 계정으로 로그인 → **프로젝트 추가**
2. 프로젝트 이름 입력 (Google Analytics는 꺼도 무방) → 생성
3. 왼쪽 메뉴 **빌드 > Firestore Database** → **데이터베이스 만들기** → 위치는 `asia-northeast3 (서울)` 권장 → **테스트 모드**가 아닌 **프로덕션 모드**로 시작 (규칙은 아래 3번에서 직접 설정)
4. 왼쪽 메뉴 **빌드 > Authentication** → **시작하기** → 로그인 방법에서 **이메일/비밀번호** 사용 설정
5. **Authentication > Users** 탭 → **사용자 추가**로 관리자 계정 생성 (예: `admin@company.com` + 비밀번호)
   - 이 계정으로 `admin.html`에 로그인합니다.

### 2-2. 웹 앱 등록 & 설정값 가져오기

1. 프로젝트 개요 화면(톱니바퀴 옆 </> 아이콘) → **웹 앱 추가** → 앱 닉네임 입력(예: "온보딩 사이트") → Firebase Hosting은 나중에 설정해도 되므로 체크 안 해도 됨 → 앱 등록
2. 화면에 표시되는 `firebaseConfig` 객체 값을 그대로 복사
3. 이 폴더의 `firebaseConfig.js`를 열어 복사한 값으로 채워넣기:
   ```js
   export const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "...",
     appId: "...",
   };
   ```

### 2-3. 보안 규칙 게시하기

1. **Firestore Database > 규칙** 탭 이동
2. 이 폴더의 `firestore.rules` 내용을 전체 복사해서 붙여넣기
3. **게시(Publish)** 클릭
   - 읽기는 누구나 가능, 쓰기(등록/수정/삭제)는 로그인한 관리자만 가능하도록 설정되어 있습니다.

### 2-4. 배포하기 — 둘 중 편한 방법 선택

**방법 A. Firebase Hosting (Firebase CLI 사용, 완전 무료)**
```bash
npm install -g firebase-tools
cd onboarding-site-firebase
firebase login
firebase init hosting   # 기존 firebase.json 사용, public 디렉터리는 "." (현재 폴더)로 지정
firebase deploy
```
배포가 끝나면 `https://your-project.web.app` 주소로 바로 접속 가능합니다.

**방법 B. GitHub Pages (Firebase CLI 없이, 계정만 있으면 됨)**
1. GitHub에 새 저장소 생성 → 이 폴더 전체 업로드
2. 저장소 **Settings > Pages** → Source를 `Deploy from a branch` → 브랜치 `main`, 폴더 `/ (root)` → Save
3. 1~2분 후 `https://<계정명>.github.io/<저장소명>/` 접속 가능

Firestore는 어디서 호스팅하든 상관없이 그대로 연결되므로, 두 방법 중 편한 쪽을 고르면 됩니다.

### 2-5. 샘플 데이터 채우기

Supabase 버전은 SQL 스크립트 한 번으로 샘플 데이터를 넣었지만, Firestore는 SQL이 없으므로
**관리자 로그인 후 "사번 관리" 탭 맨 위에 있는 "샘플 데이터 채우기" 버튼**을 한 번 눌러주세요.
가이드 7건, 공지 2건, Before/After 4건, 체크리스트 6건, 담당자 6건, 샘플 사번 2건(`10023`, `10045`)이 한 번에 채워집니다.

### 2-6. 배포 후 확인 체크리스트

- [ ] 관리자 로그인 → "샘플 데이터 채우기" 클릭
- [ ] 팀장 화면에서 사번 `10023`으로 로그인이 되는지
- [ ] 관리자에서 공지사항을 하나 추가했을 때, **팀장 화면을 새로고침하지 않아도** 바로 뜨는지 (실시간 반영 확인)
- [ ] 체크리스트 체크 상태가 새로고침 후에도 유지되는지

## 3. Firestore 컬렉션 구조 요약

| 컬렉션 | 문서 ID | 주요 필드 |
|---|---|---|
| `allowedEmployees` | 사번 | `name`, `addedAt` |
| `guides` | 자동 생성 | `title`, `content`, `category`(시스템 사용법/규정/복리후생/기타), `orderIndex` |
| `notices` | 자동 생성 | `title`, `content`, `createdAt` |
| `comparisonItems` | 자동 생성 | `category`, `beforeText`, `afterText`, `orderIndex` |
| `checklistItems` | 자동 생성 | `phase`(D1/D7/D30), `title`, `orderIndex` |
| `checklistProgress` | `{사번}__{항목ID}` | `employeeId`, `itemId`, `checked`, `checkedAt` |
| `contacts` | 자동 생성 | `taskArea`, `department`, `name`, `phone`, `email`, `orderIndex` |

## 4. 로컬에서 미리 확인하기

```bash
cd onboarding-site-firebase
python3 -m http.server 8000
```
`http://localhost:8000` (팀장), `http://localhost:8000/admin.html` (관리자) 접속.
`firebaseConfig.js`에 실제 값을 넣기 전까지는 로그인/데이터 로딩이 되지 않습니다.

## 5. 무료 한도 (Spark 플랜) 참고

- Firestore: 저장 1GB, 읽기 5만 회/일, 쓰기 2만 회/일, 삭제 2만 회/일
- Authentication: 이메일/비밀번호 로그인 무제한 무료
- Hosting: 저장 10GB, 전송 360MB/일

사내 온보딩 사이트(직원 몇백 명, 관리자 소수) 규모에서는 여유 있게 무료 범위 안에 들어옵니다.
실시간 리스너(`onSnapshot`)는 연결 유지 중에는 읽기 횟수를 추가로 소모하지 않고, 데이터가 바뀔 때만 읽기 1회로 계산됩니다.

## 6. 보안 참고사항

- `firebaseConfig.js`의 값들은 공개되어도 되는 값입니다. 실제 데이터 보호는 `firestore.rules`가 담당합니다.
- `checklistProgress`는 팀장이 별도 로그인 없이 사번만으로 기록하는 구조라 생성/수정을 열어두었습니다.
  더 엄격하게 하려면 Firebase Authentication의 익명 로그인(Anonymous Auth)을 붙여 규칙에서
  `request.auth.uid`와 사번을 매핑하는 방식으로 강화할 수 있습니다.
- `admin.html`은 Firebase Authentication 로그인으로 보호되지만, URL 자체는 공개되어 있으니
  필요하다면 저장소를 Private으로 두거나 접근 가능한 사람을 조직 내부로 안내하세요.
