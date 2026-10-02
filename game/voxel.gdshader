shader_type spatial;
render_mode diffuse_burley;
uniform vec4 team_color : source_color = vec4(0.93, 0.70, 0.14, 1.0);

varying vec3 local_position;
varying vec4 part_color;

void vertex() {
    local_position = VERTEX;
    part_color = COLOR;
}

void fragment() {
    vec3 cell = floor(local_position * 10.0);
    float grain = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float shade = 0.96 + floor(grain * 3.0) * 0.025;
    vec3 base = part_color.rgb;
    if (part_color.a < 0.75) {
        float paint_value = max(max(base.r, base.g), base.b);
        base = team_color.rgb * (paint_value / 0.93);
    }
    ALBEDO = base * shade;
    ROUGHNESS = 0.82;
}
