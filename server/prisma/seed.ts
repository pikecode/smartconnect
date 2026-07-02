import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 类别字典
  const categories = ['AI', '直播', '电商', '餐饮', '教育', '健康', '实体连锁', '区块链', '其他'];
  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // 平台管理员
  await prisma.platformAdmin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: '$2b$10$mockhashreplacewithbcrypt', // TODO: bcrypt
      role: 'super',
    },
  });

  // 测试B端
  const bTenant = await prisma.bTenant.upsert({
    where: { phone: '13800000001' },
    update: {},
    create: {
      phone: '13800000001',
      passwordHash: '$2b$10$mockhash',
      name: '杭州运营中心',
      feeCap: 99900,
      moduleConfig: { project: true, user: true, finance: true, dynamic: true },
    },
  });

  // 测试项目
  const aiCat = await prisma.category.findUniqueOrThrow({ where: { name: 'AI' } });
  const project = await prisma.project.upsert({
    where: { id: 1 },
    update: {},
    create: {
      bId: bTenant.id,
      categoryId: aiCat.id,
      title: 'AI智能客服SaaS',
      oneLiner: '面向中小企业的AI客服平台',
      intro: '基于大模型的智能客服系统,降低企业客服成本90%',
      joinMode: 'free',
      joinPrice: 0,
      bpPrice: 9900,
      auditStatus: 'approved',
    },
  });

  await prisma.projectScore.upsert({
    where: { projectId: project.id },
    update: {},
    create: {
      projectId: project.id,
      bId: bTenant.id,
      authenticity: 80,
      risk: 30,
      profitability: 70,
      reviewCount: 0,
      initialSource: 'platform',
    },
  });

  console.log('Seed complete:', { bTenant: bTenant.id, project: project.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
