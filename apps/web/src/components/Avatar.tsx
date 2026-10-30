import a0 from '../assets/av_p0.webp';
import a1 from '../assets/av_p1.webp';
import a2 from '../assets/av_p2.webp';
import a3 from '../assets/av_p3.webp';

const AV = [a0, a1, a2, a3];

/** Avatar 3D (render sendiri). seed 0..3. */
export function Avatar({ seed }: { seed: number }) {
  return <img className="avatar-img" src={AV[seed % AV.length]} alt="" draggable={false} />;
}
