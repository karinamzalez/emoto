// Per-channel scalar UV offset for chromatic dispersion.
// channel: 0 = R (least bent), 1 = G (mid), 2 = B (most bent).
// Multiply the returned scalar by a direction vector in the caller.
float dispersedOffset(int channel, float strength) {
  if (channel == 0) return  strength;
  if (channel == 1) return  0.0;
               else return -strength;
}
