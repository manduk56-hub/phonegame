# 게임 모델을 활용한 대표 이미지

두 이미지는 게임에서 사용하는 모델과 재질을 Godot로 직접 렌더링한다.

- 고래·크릴: `game/krill-models.json`, `game/krill.gd`, `game/render_krill_card.gd`
- 낚시배·낚시꾼: `game/fishing-models.json`, `game/fishing.gd`, `game/render_fishing_card.gd`

`npm run render:covers`로 두 이미지를 다시 생성할 수 있다. 로컬 Godot를 자동으로 찾거나 `GODOT_EXE` 환경변수로 실행 파일을 지정한다. 실제 게임 상태를 사용한 낚시 장면의 임시 데이터는 `.runtime` 아래에 생성한다.

결과는 `game/assets`와 `public/assets`의 `krill-card.png`, `fishing-card.png`에 함께 저장한다. 게임 모델의 형태와 재질을 유지하고 대표 이미지용 카메라 구도와 포즈만 조정한다.
