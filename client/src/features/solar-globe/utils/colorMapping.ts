export const getColorForValue = (normalized: number): [number, number, number] => {
  let r, g, b;
  
  if (normalized < 0.4) {
    const t = normalized / 0.4;
    r = Math.floor(100 + t * 155);
    g = Math.floor(t * 200);
    b = 0;
  } else if (normalized < 0.48) {
    const t = (normalized - 0.4) / 0.08;
    r = Math.floor(255 - t * 55);
    g = Math.floor(200 - t * 50);
    b = Math.floor(t * 150);
  } else if (normalized < 0.52) {
    r = 150;
    g = 150;
    b = 150;
  } else if (normalized < 0.6) {
    const t = (normalized - 0.52) / 0.08;
    r = Math.floor(150 - t * 150);
    g = Math.floor(150 + t * 105);
    b = Math.floor(150 - t * 50);
  } else {
    const t = (normalized - 0.6) / 0.4;
    r = 0;
    g = Math.floor(255 - t * 255);
    b = Math.floor(100 + t * 155);
  }
  
  return [r, g, b];
};

export const getColorShaderCode = (): string => {
  return `
    vec3 getColorForValue(float normalized) {
      float r, g, b;
      
      if (normalized < 0.4) {
        float t = normalized / 0.4;
        r = (100.0 + t * 155.0) / 255.0;
        g = (t * 200.0) / 255.0;
        b = 0.0;
      } else if (normalized < 0.48) {
        float t = (normalized - 0.4) / 0.08;
        r = (255.0 - t * 55.0) / 255.0;
        g = (200.0 - t * 50.0) / 255.0;
        b = (t * 150.0) / 255.0;
      } else if (normalized < 0.52) {
        r = 150.0 / 255.0;
        g = 150.0 / 255.0;
        b = 150.0 / 255.0;
      } else if (normalized < 0.6) {
        float t = (normalized - 0.52) / 0.08;
        r = (150.0 - t * 150.0) / 255.0;
        g = (150.0 + t * 105.0) / 255.0;
        b = (150.0 - t * 50.0) / 255.0;
      } else {
        float t = (normalized - 0.6) / 0.4;
        r = 0.0;
        g = (255.0 - t * 255.0) / 255.0;
        b = (100.0 + t * 155.0) / 255.0;
      }
      
      return vec3(r, g, b);
    }
  `;
};