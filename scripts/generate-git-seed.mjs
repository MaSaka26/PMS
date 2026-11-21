// 从 git log 生成种子数据：每个提交对应一个任务，时间与提交人取自仓库记录
// 用法：npm run seed:git（生成结果 src/mock/db/seed/gitSeed.js 需要一起提交）
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SEP = '\x1f'

const raw = execFileSync(
  'git',
  ['log', '--no-merges', '--reverse', `--pretty=format:%H${SEP}%h${SEP}%an${SEP}%ae${SEP}%aI${SEP}%s`],
  { cwd: root, encoding: 'utf8' }
)

const commits = raw
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [hash, shortHash, author, email, date, subject] = line.split(SEP)
    return { hash, shortHash, author, email, date, subject }
  })

// 作者 → 成员 id，从 u5 开始按首次提交顺序编号
const authors = []
for (const c of commits) {
  if (!authors.some((a) => a.email === c.email)) {
    authors.push({ id: `u${authors.length + 5}`, name: c.author, email: c.email })
  }
}

const authorIdOf = (email) => authors.find((a) => a.email === email).id

const output = `// 本文件由 scripts/generate-git-seed.mjs 生成，请勿手动修改
// 数据来源：git log --no-merges --reverse
export const generatedAt = ${JSON.stringify(new Date().toISOString())}
export const authors = ${JSON.stringify(authors, null, 2)}
export const commits = ${JSON.stringify(
  commits.map((c) => ({ ...c, authorId: authorIdOf(c.email) })),
  null,
  2
)}
`

writeFileSync(resolve(root, 'src/mock/db/seed/gitSeed.js'), output, 'utf8')
console.log(`已生成 ${commits.length} 条提交、${authors.length} 位作者 → src/mock/db/seed/gitSeed.js`)
