extends SceneTree
func _initialize() -> void:
 run.call_deferred()
func run() -> void:
 var hub = load("res://main_menu.tscn").instantiate()
 root.add_child(hub)
 for frame in range(8):
  await process_frame
 var card_size: Vector2 = hub.cards[0].size
 for page in range(3):
  hub.select_game(page*4)
  for frame in range(4):
   await process_frame
  var visible_cards = hub.cards.filter(func(card):return card.visible)
  assert(visible_cards.size() == mini(4,hub.GAMES.size()-page*4))
  for card in visible_cards:
   assert(card.size.x >= 240 and card.size.y >= 240)
   assert(absf(card.size.x-card.size.y) <= 1, "Card must be square")
   assert(absf(card.size.x-card_size.x) <= 1 and absf(card.size.y-card_size.y) <= 1, "Card size changed across pages")
   assert(card.get_global_rect().end.y < hub.page_label.global_position.y)
   assert(card.get_global_rect().end.x <= hub.detail_art.global_position.x)
   for child in card.get_child(0).get_children():
    assert(card.get_global_rect().encloses(child.get_global_rect()), "Card content overflow: %s %s" % [card.name,child.get_global_rect()])
  assert(hub.next_page.disabled == (page == 2))
  if OS.get_environment("PLAYROOM_UI_CAPTURE") == "1":
   await RenderingServer.frame_post_draw
   root.get_texture().get_image().save_png("res://../.runtime/catalog-page-%d.png" % page)
 hub.change_page(-1)
 assert(hub.selected == 4)
 print("PASS: four cards per page, last page, navigation, image and text containment")
 quit()
