/**
 * 개발용 Supabase 프로젝트 설정 자동화 스크립트
 * 
 * 사용법:
 * 1. 먼저 Supabase 대시보드에서 새 프로젝트를 수동으로 생성
 * 2. 프로젝트 URL과 anon key를 복사
 * 3. node scripts/setup-dev-supabase.js 실행
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupDevSupabase() {
  console.log('🚀 개발용 Supabase 프로젝트 설정을 시작합니다...\n');
  
  console.log('📋 먼저 다음 단계를 완료해주세요:');
  console.log('1. https://supabase.com/dashboard 접속');
  console.log('2. "New Project" 클릭');
  console.log('3. 프로젝트명: uplus-assistant-dev');
  console.log('4. 지역: Northeast Asia (Seoul)');
  console.log('5. 프로젝트 생성 완료 후 Settings > API 메뉴에서 정보 확인\n');
  
  const ready = await question('위 단계를 완료하셨나요? (y/n): ');
  if (ready.toLowerCase() !== 'y') {
    console.log('프로젝트 생성을 완료한 후 다시 실행해주세요.');
    rl.close();
    return;
  }
  
  console.log('\n📝 프로젝트 정보를 입력해주세요:');
  
  const projectUrl = await question('Project URL (https://xxx.supabase.co): ');
  const anonKey = await question('Anon public key: ');
  
  if (!projectUrl || !anonKey) {
    console.log('❌ URL과 키를 모두 입력해주세요.');
    rl.close();
    return;
  }
  
  // .env.development 파일 업데이트
  const envDevPath = path.join(__dirname, '..', '.env.development');
  const envDevContent = `# 개발용 Supabase 설정
VITE_CLAUDE_API_KEY=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
VITE_SUPABASE_URL=${projectUrl}
VITE_SUPABASE_ANON_KEY=${anonKey}
`;
  
  fs.writeFileSync(envDevPath, envDevContent);
  
  // .env 파일을 개발 환경으로 설정
  const envPath = path.join(__dirname, '..', '.env');
  fs.writeFileSync(envPath, envDevContent);
  
  console.log('\n✅ 환경 변수 설정 완료!');
  console.log('📁 .env.development 파일이 업데이트되었습니다.');
  console.log('📁 .env 파일이 개발 환경으로 설정되었습니다.\n');
  
  console.log('🗄️  다음 단계: 데이터베이스 마이그레이션');
  console.log('Supabase 대시보드의 SQL Editor에서 다음 파일들을 순서대로 실행하세요:');
  console.log('1. supabase/migrations/20250618102305_polished_sunset.sql');
  console.log('2. supabase/migrations/20250618102312_jolly_rice.sql');
  console.log('3. supabase/migrations/20250623075309_light_truth.sql');
  console.log('4. supabase/migrations/20250624072533_falling_gate.sql\n');
  
  console.log('🚀 마이그레이션 완료 후 다음 명령어로 개발 서버를 실행하세요:');
  console.log('npm run dev\n');
  
  rl.close();
}

setupDevSupabase().catch(console.error);