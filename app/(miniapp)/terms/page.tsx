// app/(miniapp)/terms/page.tsx
// Страница пользовательских соглашений

'use client';

export default function TermsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      padding: '20px',
      paddingBottom: '120px',
    }}>
      <h1 style={{
        fontSize: '32px',
        fontWeight: 'bold',
        color: '#0A5F59',
        marginBottom: '8px',
      }}>
        Пользовательские соглашения
      </h1>
      <p style={{ fontSize: '16px', color: '#475467', marginBottom: '24px' }}>
        Условия использования приложения SkinIQ
      </p>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid #F3F4F6',
      }}>
        <div style={{ fontSize: '16px', color: '#1F2937', lineHeight: '1.8' }}>
          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0A5F59', marginBottom: '12px' }}>
              1. Общие положения
            </h2>
            <p style={{ marginBottom: '12px' }}>
              Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения между 
              пользователем приложения SkinIQ (далее — «Пользователь») и разработчиком приложения 
              ИП Биктимирова (далее — «Разработчик»).
            </p>
            <p>
              Используя приложение SkinIQ, Пользователь соглашается с условиями настоящего Соглашения.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0A5F59', marginBottom: '12px' }}>
              2. Описание сервиса
            </h2>
            <p style={{ marginBottom: '12px' }}>
              SkinIQ — это приложение для создания персонального плана ухода за кожей на основе 
              анализа ответов пользователя в анкете. Приложение предоставляет рекомендации по средствам 
              ухода и помогает отслеживать прогресс.
            </p>
            <p>
              Все рекомендации носят информационный характер и не заменяют консультацию с врачом-дерматологом.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0A5F59', marginBottom: '12px' }}>
              3. Персональные данные
            </h2>
            <p style={{ marginBottom: '12px' }}>
              Приложение собирает и обрабатывает персональные данные пользователя, включая:
            </p>
            <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
              <li>Данные профиля Telegram (имя, username, фото)</li>
              <li>Ответы в анкете о состоянии кожи</li>
              <li>Информацию об использовании приложения</li>
            </ul>
            <p>
              Все данные хранятся в зашифрованном виде и используются исключительно для предоставления 
              сервиса. Разработчик обязуется не передавать персональные данные третьим лицам без согласия пользователя.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0A5F59', marginBottom: '12px' }}>
              4. Ограничение ответственности
            </h2>
            <p style={{ marginBottom: '12px' }}>
              Разработчик не несет ответственности за:
            </p>
            <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
              <li>Результаты использования рекомендованных средств</li>
              <li>Аллергические реакции или побочные эффекты</li>
              <li>Доступность средств в магазинах и аптеках</li>
              <li>Изменения цен на рекомендованные продукты</li>
            </ul>
            <p>
              Пользователь понимает, что рекомендации приложения не являются медицинским советом 
              и перед использованием любых средств следует проконсультироваться с врачом, особенно 
              при наличии кожных заболеваний или аллергий.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0A5F59', marginBottom: '12px' }}>
              5. Интеллектуальная собственность
            </h2>
            <p>
              Все материалы приложения, включая дизайн, алгоритмы, тексты и изображения, являются 
              интеллектуальной собственностью Разработчика и защищены авторским правом.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0A5F59', marginBottom: '12px' }}>
              6. Контакты
            </h2>
            <p style={{ marginBottom: '8px' }}>
              <strong>Разработчик:</strong> ИП Биктимирова
            </p>
            <p>
              По вопросам использования приложения обращайтесь в поддержку через раздел "Поддержка" 
              в приложении.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0A5F59', marginBottom: '12px' }}>
              7. Изменения в Соглашении
            </h2>
            <p>
              Разработчик оставляет за собой право изменять настоящее Соглашение. Пользователь будет 
              уведомлен о существенных изменениях через приложение. Продолжение использования приложения 
              после изменений означает согласие с новыми условиями.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

