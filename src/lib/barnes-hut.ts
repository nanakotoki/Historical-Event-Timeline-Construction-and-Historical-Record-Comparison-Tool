/**
 * Barnes-Hut 四叉树斥力（O(n log n)）
 * ------------------------------------------------------------------
 * 力导向布局的斥力天然是「每个点对其余每个点」，两两遍历即 O(n²)。
 * 实测这份图在 642 人时 0.9 秒尚可，但节点翻到三倍就要 26 秒、五倍 97 秒
 * （`scripts/bench-layout.mjs` 的原始数据）。这是加人物时的硬天花板。
 *
 * 四叉树的思路不是「少算几个点」，而是**换个算法**：
 * 把空间递归四等分，每个格子记下「这团点的总质量与质心」。
 * 对远处的一整团，用质心当作一个点代算即可——误差可忽略，而代价从「这团有多少人」
 * 变成「常数」。
 *
 * 判定「够远」的经典准则是 `格子边长 / 距离 < θ`（θ 即 theta）：
 *  - θ = 0   → 永不代算，等价于原来的两两精确计算（慢，但结果逐位相同）
 *  - θ = 0.85→ 与 d3-force 的常用值同量级，视觉上无可辨差异
 *  - θ → 1+  → 更快更糙，远处星云会被过度抹平
 *
 * 斥力式沿用 Fruchterman–Reingold 的 `k² / d`（不是库仑的 1/d²），
 * 与 `graph-layout.ts` 原实现保持一致，换算法不换物理模型。
 *
 * ## 为什么用类型化数组池
 * 第一版写成了「每轮清空九个普通数组、再逐个 push」。跑出来只快 1.8 倍，
 * 而按 n log n 的推算本该快 4 倍以上——把 θ 从 0.7 调到 1.2 只省 30%，
 * 说明瓶颈根本不在遍历，而在**建树**：800 轮 × 642 点，每次插入要 push 几十个
 * 数组元素、还要反复扩容，这部分是纯粹的分配开销，与算法复杂度无关。
 * 改成预分配的 TypedArray + 游标之后，建树退化为「按下标写值」，不产生任何新对象。
 */

/**
 * 树深上限。
 * 正常情况下深度约 log₄(n)，三千人也就七八层；但若两点坐标几乎重合，
 * 象限判定会总是把它们分到同一格，一路下沉到底。所以必须有硬上限——
 * 触底后放弃插入该点（它仍能作为查询主体参与受力，只是暂不作为「源」）。
 * 这是有意的近似：与其为了一个重合点死循环，不如让它在下一轮被推开后自然归位。
 */
const MAX_DEPTH = 24;

/** 查询栈的深度上限：每层最多压 4 个子格，24 层封顶也就 96，1024 足够宽松。 */
const STACK_SIZE = 1024;

function quadrant(cx: number, cy: number, x: number, y: number): number {
  return (x >= cx ? 1 : 0) + (y >= cy ? 2 : 0);
}

export class BarnesHut {
  /* 七个并行数组：half/centerX/centerY 是格子几何，childBase 是子格起点，
     body 是叶子里那一个点的下标，mass/comX/comY 是子树的质量与质心。
     mass/comX/comY 只在累加阶段写，且只在 mass > 0 时被读，
     所以跨轮不必清零——这一条省掉了每轮 n 次 fill。 */
  private half = new Float64Array(0);
  private centerX = new Float64Array(0);
  private centerY = new Float64Array(0);
  private childBase = new Int32Array(0);
  private body = new Int32Array(0);
  private mass = new Float64Array(0);
  private comX = new Float64Array(0);
  private comY = new Float64Array(0);

  private capacity = 0;
  private cellCount = 0;

  private xs: Float64Array = new Float64Array(0);
  private ys: Float64Array = new Float64Array(0);
  private readonly stack = new Int32Array(STACK_SIZE);

  private ensureCapacity(need: number): void {
    if (need <= this.capacity) return;
    let cap = this.capacity || 1024;
    while (cap < need) cap *= 2;
    const from = this.capacity;

    const g = (src: Float64Array) => {
      const next = new Float64Array(cap);
      next.set(src);
      return next;
    };
    const gi = (src: Int32Array) => {
      const next = new Int32Array(cap);
      next.set(src);
      return next;
    };

    this.half = g(this.half);
    this.centerX = g(this.centerX);
    this.centerY = g(this.centerY);
    this.mass = g(this.mass);
    this.comX = g(this.comX);
    this.comY = g(this.comY);

    const nextChild = gi(this.childBase);
    const nextBody = gi(this.body);
    // 新扩出来的区域必须是「空叶」，即 childBase/body 都为 -1（0 会被误读成「指向第 0 格」）
    nextChild.fill(-1, from);
    nextBody.fill(-1, from);
    this.childBase = nextChild;
    this.body = nextBody;

    this.capacity = cap;
  }

  private allocCell(h: number, cx: number, cy: number): number {
    const i = this.cellCount;
    if (i >= this.capacity) this.ensureCapacity(i + 1);
    this.half[i] = h;
    this.centerX[i] = cx;
    this.centerY[i] = cy;
    this.childBase[i] = -1;
    this.body[i] = -1;
    this.cellCount = i + 1;
    return i;
  }

  /** 建树。必须每轮重建——位置每轮都在变，复用旧树会算错。 */
  build(xs: Float64Array, ys: Float64Array, n: number): void {
    this.xs = xs;
    this.ys = ys;
    this.cellCount = 0;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i += 1) {
      const x = xs[i];
      const y = ys[i];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    // 根格取正方形：四叉树靠对半切分，若按包围盒的长宽分别取半，
    // 象限划分会失真（宽扁的格子切出来仍是宽扁的，深的那一侧永远分不开）。
    const side = Math.max(maxX - minX, maxY - minY, 1e-3) * 1.001;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    this.allocCell(side / 2, cx, cy);

    for (let i = 0; i < n; i += 1) this.insert(0, i, 0);
  }

  private insert(node: number, b: number, depth: number): void {
    if (depth >= MAX_DEPTH) return;

    const base = this.childBase[node];
    if (base < 0) {
      const existing = this.body[node];
      if (existing < 0) {
        this.body[node] = b;
        return;
      }
      // 已是单点叶：分裂成四个子格，两个 body 各自下沉一层
      this.body[node] = -1;
      const cx = this.centerX[node];
      const cy = this.centerY[node];
      const h = this.half[node] / 2;
      const start = this.allocCell(h, cx - h, cy - h); // 象限 0
      this.allocCell(h, cx + h, cy - h); // 1
      this.allocCell(h, cx - h, cy + h); // 2
      this.allocCell(h, cx + h, cy + h); // 3
      this.childBase[node] = start;
      this.insert(start + quadrant(cx, cy, this.xs[existing], this.ys[existing]), existing, depth + 1);
      this.insert(start + quadrant(cx, cy, this.xs[b], this.ys[b]), b, depth + 1);
      return;
    }

    this.insert(base + quadrant(this.centerX[node], this.centerY[node], this.xs[b], this.ys[b]), b, depth + 1);
  }

  /** 后序累加质量与质心。插入时不做增量更新——分裂会让旧 body 重走一遍，增量会重复计数。 */
  private accumulate(node: number): void {
    const base = this.childBase[node];
    if (base < 0) {
      const b = this.body[node];
      // 空叶也要显式写 0：mass 跨轮不清零，残留上一轮的值会让遍历走错分支
      this.mass[node] = b >= 0 ? 1 : 0;
      if (b >= 0) {
        this.comX[node] = this.xs[b];
        this.comY[node] = this.ys[b];
      }
      return;
    }
    let m = 0;
    let ax = 0;
    let ay = 0;
    for (let q = 0; q < 4; q += 1) {
      const c = base + q;
      this.accumulate(c);
      const cm = this.mass[c];
      if (cm > 0) {
        m += cm;
        ax += this.comX[c] * cm;
        ay += this.comY[c] * cm;
      }
    }
    this.mass[node] = m;
    if (m > 0) {
      this.comX[node] = ax / m;
      this.comY[node] = ay / m;
    }
  }

  /**
   * 把斥力累加进 outX / outY。调用方需在每轮迭代前自行清零。
   * 注意：与原来两两累加（i 加、j 减）不同，这里每个点独立查询，
   * 因此合力在数值上只是近似对称——这是四叉树的固有属性，不影响布局收敛。
   */
  apply(n: number, k: number, theta: number, outX: Float64Array, outY: Float64Array): void {
    if (this.cellCount === 0) return;
    this.accumulate(0);

    const theta2 = theta * theta;
    const k2 = k * k;
    const { half, childBase, body, mass, comX, comY, xs, ys, stack } = this;

    for (let i = 0; i < n; i += 1) {
      const xi = xs[i];
      const yi = ys[i];
      let fx = 0;
      let fy = 0;

      let sp = 0;
      stack[sp++] = 0;

      while (sp > 0) {
        const node = stack[--sp];
        const m = mass[node];
        if (m === 0) continue;
        // 单点叶且就是自己：跳过，不然会自己斥自己
        if (childBase[node] < 0 && body[node] === i) continue;

        let vx = xi - comX[node];
        let vy = yi - comY[node];
        let d2 = vx * vx + vy * vy;
        const side = half[node] * 2;

        // 单点叶必精确；否则看「格子够不够远」决定是否整团代算
        if (childBase[node] < 0 || side * side < theta2 * d2) {
          if (d2 < 1e-6) {
            // 两点几乎重合：按索引给确定性微扰，避免除零出 NaN。
            // 用索引而非随机数，是为了同一份数据每次跑出同一张图。
            vx = ((((i * 2654435761) >>> 0) % 13) - 6) * 0.1 + 0.05;
            vy = ((((i * 2246822519) >>> 0) % 11) - 5) * 0.1 + 0.05;
            d2 = vx * vx + vy * vy;
          }
          const d = Math.sqrt(d2);
          /* 关键：乘上 node 的质量。
             FR 的斥力 `k²/d` 是「每一对点各贡献一份」，所以一团 m 个点对一个点的
             合力是 m·k²/d。把这个因子漏掉，远处的大团就会被当成一个人来推——
             不是「稍微不准」，而是物理模型错了：人数越多的地方斥力越该大。
             第一版正是漏在这里，A/B 对照才发现距离相关性只有 0.98、
             最近邻间距虚高四成。 */
          const f = (m * k2) / d;
          fx += (vx / d) * f;
          fy += (vy / d) * f;
        } else {
          const base = childBase[node];
          for (let q = 0; q < 4; q += 1) {
            const c = base + q;
            if (mass[c] > 0 && sp < STACK_SIZE) stack[sp++] = c;
          }
        }
      }

      outX[i] += fx;
      outY[i] += fy;
    }
  }
}
