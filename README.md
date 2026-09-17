# 🦇 3D SURVIVAL

**Vampire Survivors 스타일 3D 서바이벌 게임** — 브라우저에서 바로 플레이 (빌드 불필요)

![three.js](https://img.shields.io/badge/three.js-r160-ff69b4) ![license](https://img.shields.io/badge/assets-CC0%20(Kenney)-50fa7b)

## ▶ 플레이

GitHub Pages URL에 접속하면 바로 시작됩니다. (이 리포지토리의 **Pages** 탭에서 확인 가능)

## 조작법

| 키 | 동작 |
|---|---|
| `W A S D` | 이동 (카메라 기준) |
| 마우스 | 시점 회전 (클릭 후 포인터록) |
| `SPACE` | 점프 |
| `1 2 3` | 레벨업 카드 선택 |
| `ESC` | 일시정지 |
| `R` | 게임 오버 후 리스타트 |

## 특징

- **자동 전투**: 채찍·화염봉·회전 단검·낙뢰·검의 기운 — 모두 자동 조준
- **레벨업 3택1**: Vampire Survivors 스타일 무기 획득/강화 + 상태 강화(데미지/공속/체력/자석/점프)
- **몬스터 4종 + 보스**: 좀비·해골(빠름)·유령(비행)·뱀파이어(탱키), 90초마다 보스 등장
- **시간 기반 난이도**: 초반은 조용하고, 시간이 지날수록 스폰이 밀려듦
- **3D 월드**: 달빛·그림자·등불 플리커·별, Kenney CC0 에셋(묘지 킷 + 미니 던전)
- **WebAudio 효과음 + 절차적 BGM**

## 기술

- 단일 `index.html` + `main.js` (ES modules, three.js CDN importmap)
- InstancedMesh 기반 적/젠 렌더링 (수백 개 적도 60fps)
- WebAudio 합성 SFX + Kenney CC0 사운드 팩
- 빌드 스텝 없음 — 정적 파일만

## 에셋 크레딧

모든 모델·사운드는 [Kenney.nl](https://kenney.nl/assets) — **CC0 1.0** (라이선스 자유)

- Graveyard Kit (몬스터/무덤/등불/관 등)
- Mini Dungeon (나무/바위/유물)
- Sci-Fi Sounds, Impact Sounds, RPG Audio (효과음)

## 구조

```
index.html   — HTML + HUD UI
main.js      — 게임 전체 (렌더러·플레이어·무기·적·XP·UI·오디오)
assets/models/  — Kenney GLB 모델 (CC0)
assets/sfx/     — Kenney 효과음 OGG (CC0)
```
