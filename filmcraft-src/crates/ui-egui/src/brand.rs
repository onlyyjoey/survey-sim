//! The ArtCraft wordmark is a trademark that modified copies of FilmCraft must not carry
//! (docs/brand/LICENSE-brand.txt in the upstream repository, "Forks and modified versions").
//! This touch-control copy therefore draws no wordmark; callers already handle `None`.

/// Always `None` in this modified copy: no ArtCraft wordmark.
pub fn wordmark(_ctx: &egui::Context, _dark: bool) -> Option<egui::TextureHandle> {
    None
}

/// Draws nothing and returns `None` in this modified copy.
pub fn paint_wordmark(_ui: &egui::Ui, _left_center: egui::Pos2, _height: f32, _dark: bool) -> Option<egui::Rect> {
    None
}
