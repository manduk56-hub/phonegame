extends Control

const FONT = preload("res://fonts/NeoDunggeunmoPro-Regular.ttf")
var socket := WebSocketPeer.new()
var server_url := "http://127.0.0.1:3000"
var admin_key := ""
var authenticated := false
var state: Dictionary = {}
var elapsed := 0.0
var retry := -5.0
var status: Label
var scores: Label
var notice: Label
var join_label: Label
var qr: TextureRect
var start_button: Button
var return_button: Button
var fixture := false
var frames := 0
var connection_signature := ""

func label(text: String, at: Vector2, font_size: int) -> Label:
	var l := Label.new()
	l.text = text
	l.position = at
	l.add_theme_font_size_override("font_size",font_size)
	add_child(l)
	return l

func _ready() -> void:
	var t := Theme.new()
	t.default_font = FONT
	preload("res://pixel_ui.gd").apply(t)
	theme = t
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	if not OS.get_environment("DIRT_RALLY_SERVER_URL").is_empty():
		server_url = OS.get_environment("DIRT_RALLY_SERVER_URL").trim_suffix("/")
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--server="):
			server_url = arg.trim_prefix("--server=")
	status = label("MOLE MISCHIEF · 두더지 잡기",Vector2(32,22),34)
	notice = label("서버 연결 중",Vector2(32,142),24)
	scores = label("",Vector2(1080,350),22)
	join_label = label("QR로 참가하세요",Vector2(1080,230),18)
	qr = TextureRect.new()
	qr.position = Vector2(1080,22)
	qr.size = Vector2(195,195)
	qr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	add_child(qr)
	start_button = Button.new()
	start_button.text = "경기 시작"
	start_button.position = Vector2(1080,290)
	start_button.pressed.connect(func():send_admin({"type":"start"}))
	add_child(start_button)
	return_button = Button.new()
	return_button.text = "대기실"
	return_button.position = Vector2(1240,290)
	return_button.pressed.connect(func():send_admin({"type":"lobby"}))
	add_child(return_button)
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--mole-fixture="):
			fixture = true
			accept_state(JSON.parse_string(FileAccess.get_file_as_string(arg.trim_prefix("--mole-fixture="))))
	if not fixture:
		fetch_config()

func send_admin(value: Dictionary) -> void:
	if authenticated and socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		socket.send_text(JSON.stringify(value))

func fetch_config() -> void:
	var req := HTTPRequest.new()
	req.timeout = 4
	add_child(req)
	req.request_completed.connect(func(_result,code,_headers,body):
		if code == 200:
			var config = JSON.parse_string(body.get_string_from_utf8())
			if config is Dictionary:
				admin_key = OS.get_environment("DIRT_RALLY_HOST_KEY") if config.get("hostAuth") == "token" else str(config.get("adminKey",""))
				join_label.text = "참가 코드 %s\n%s" % [config.room,config.joinAddress]
				load_qr()
		req.queue_free()
	)
	req.request(server_url+"/config")

func load_qr() -> void:
	var req := HTTPRequest.new()
	add_child(req)
	req.request_completed.connect(func(_result,code,_headers,body):
		if code == 200:
			var image := Image.new()
			if image.load_svg_from_buffer(body) == OK:
				qr.texture = ImageTexture.create_from_image(image)
		req.queue_free()
	)
	req.request(server_url+"/qr")

func accept_state(m: Dictionary) -> void:
	if m.get("game") != "mole":
		return
	state = m
	var s: Dictionary = m.mole
	var mole_name := ""
	var connected := 0
	var rows := PackedStringArray()
	for p in m.players:
		if p.id == s.moleId:
			mole_name = p.name
		if p.connected:
			connected += 1
		rows.append("%s · %d점%s" % [p.name,p.score," · 두더지" if p.id == s.moleId else ""])
	scores.text = "실시간 점수\n\n"+"\n".join(rows)
	notice.text = "모두 한 번씩 25초간 두더지 · 명중 +3 / 회피 +1 / 빗나감 −1"
	if m.phase == "running":
		status.text = "MOLE MISCHIEF · %d/%d 라운드 · %d초" % [s.turn+1,s.turns,ceili(s.turnLeft)]
		notice.text = mole_name+" 두더지를 잡아라! · "+str(s.event)
	elif m.phase == "finished":
		var names := PackedStringArray()
		for p in m.players:
			if m.results.winnerIds.has(p.id):
				names.append(p.name)
		notice.text = "우승: "+", ".join(names)
	start_button.disabled = not authenticated or m.phase != "lobby" or connected < 2
	return_button.disabled = not authenticated or m.phase == "lobby"
	var signature := JSON.stringify(m.get("connection",{}))
	if signature != connection_signature and not fixture:
		connection_signature = signature
		fetch_config()
	queue_redraw()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO,size),Color("#292b25"))
	draw_rect(Rect2(40,205,990,580),Color("#758849"))
	draw_rect(Rect2(40,205,990,580),Color("#b59556"),false,6)
	var s: Dictionary = state.get("mole",{})
	for i in range(9):
		var center := Vector2(205+(i%3)*325,310+floor(i/3.0)*185)
		draw_set_transform(center,0,Vector2(1,.62))
		draw_circle(Vector2.ZERO,91,Color("#b59556"))
		draw_circle(Vector2.ZERO,80,Color("#271d1b"))
		draw_set_transform(Vector2.ZERO)
		if s.get("visible",false) and int(s.get("hole",-1)) == i and state.get("phase") == "running":
			draw_circle(center+Vector2(0,-27),56,Color("#bd855b"))
			draw_circle(center+Vector2(-19,-37),6,Color("#271d1b"))
			draw_circle(center+Vector2(19,-37),6,Color("#271d1b"))
			draw_circle(center+Vector2(0,-15),19,Color("#efb093"))
			draw_circle(center+Vector2(0,-23),7,Color("#75433c"))
		draw_string(FONT,center+Vector2(-6,39),str(i+1),HORIZONTAL_ALIGNMENT_LEFT,-1,24,Color("#fff0cd"))

func _process(delta: float) -> void:
	elapsed += delta
	if fixture:
		frames += 1
		if frames == 12:
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("res://../.runtime/mole-pc.png")
			get_tree().quit()
		return
	socket.poll()
	if socket.get_ready_state() == WebSocketPeer.STATE_CLOSED and elapsed-retry > 2:
		retry = elapsed
		authenticated = false
		start_button.disabled = true
		socket.remove_meta("joined")
		fetch_config()
		socket.connect_to_url(server_url.replace("https://","wss://").replace("http://","ws://"))
	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		if not socket.has_meta("joined") and not admin_key.is_empty():
			socket.send_text(JSON.stringify({"type":"host","key":admin_key}))
			socket.set_meta("joined",true)
		while socket.get_available_packet_count() > 0:
			var m = JSON.parse_string(socket.get_packet().get_string_from_utf8())
			if not m is Dictionary:
				continue
			if m.type == "host-ready":
				authenticated = true
				send_admin({"type":"game","game":"mole"})
			elif m.type == "state" and authenticated:
				accept_state(m)
			elif m.type == "error":
				notice.text = m.message
