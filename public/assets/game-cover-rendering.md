# 게임 모델을 활용한 대표 이미지

두 이미지는 게임에서 사용하는 모델과 재질을 Godot로 직접 렌더링한다.

- 고래·크릴: `game/krill-models.json`, `game/krill.gd`, `game/render_krill_card.gd`
- 낚시배·낚시꾼: `game/fishing-models.json`, `game/fishing.gd`, `game/render_fishing_card.gd`

`npm run render:covers`로 두 이미지를 다시 생성할 수 있다. 로컬 Godot를 자동으로 찾거나 `GODOT_EXE` 환경변수로 실행 파일을 지정한다. 실제 게임 상태를 사용한 낚시 장면의 임시 데이터는 `.runtime` 아래에 생성한다.

결과는 `game/assets`와 `public/assets`의 `krill-card.png`, `fishing-card.png`에 함께 저장한다. 게임 모델의 형태와 재질을 유지하고 대표 이미지용 카메라 구도와 포즈만 조정한다.

## 신규 게임 대표 이미지

`game/render_party_cards.gd`는 기존 대표 이미지와 같은 Godot 블록형 모델·단색 재질·사선 카메라 방식으로 다음 두 이미지를 만든다. `npm run render:covers`에도 포함된다.

- `clover-card.png`: `clover.gd`의 실제 잎 메시와 참가자 생성 코드를 사용한다. 대표 네잎은 같은 메시를 확대하고 번호와 UI는 숨긴다.
- `mole-card.png`: 2D 두더지의 갈색 몸통·검은 눈·분홍 주둥이와 3×3 구멍판을 블록형 3D로 구성한다.

두 파일은 `game/assets`와 `public/assets`에 함께 저장하고 PC 및 웹 게임 선택 카드와 상세 미리보기에서 사용한다. AI로 생성한 시안은 사용하지 않는다.
