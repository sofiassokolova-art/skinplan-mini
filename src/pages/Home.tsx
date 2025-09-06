// src/pages/Home.tsx
import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card } from "../ui";

type PlanItem = {
  name: string;
  timeOfDay?: "morning" | "evening";
  step?: number;
};

type SavedPlan = {
  morning: PlanItem[];
  evening: PlanItem[];
};

export default function Home() {
  const navigate = useNavigate();

  // Имя из анкеты
  const userName: string | undefined = useMemo(() => {
    try {
      const raw = localStorage.getItem("skiniq.answers");
      const obj = raw ? JSON.parse(raw) : {};
      return obj?.name || undefined;
    } catch {
      return undefined;
    }
  }, []);

  // Приветствие по локальному времени устройства
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const isEvening = hour >= 18; // 18:00+ — вечер
    return `${isEvening ? "Добрый вечер" : "Добрый день"}${userName ? `, ${userName}` : ""}`;
  }, [userName]);

  // Анкета/план
  const hasAnswers = useMemo(() => {
    try {
      const raw = localStorage.getItem("skiniq.answers");
      if (!raw) return false;
      const obj = JSON.parse(raw);
      const name = typeof obj?.name === "string" ? obj.name.trim() : "";
      return name.length > 0;
    } catch {
      return false;
    }
  }, []);

  // Пытаемся прочитать последний сохранённый план (его кладёт страница /plan)
  const savedPlan: SavedPlan | null = useMemo(() => {
    try {
      const raw = localStorage.getItem("skiniq.plan");
      return raw ? (JSON.parse(raw) as SavedPlan) : null;
    } catch {
      return null;
    }
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      {userName && (
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl font-semibold">{greeting}!</h1>
          {/* Ссылка перепройти анкету показывается, только если анкета была */}
          {hasAnswers && (
            <Link to="/quiz" className="text-sm text-neutral-500 underline">
              Перепройти анкету
            </Link>
          )}
        </div>
      )}

      {hasAnswers && savedPlan && (
        <Card className="mb-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Ближайшая рутина</h2>
              <p className="text-sm text-neutral-600">
                Короткий дайджест твоих шагов на сегодня
              </p>
            </div>
            <div>
              <Button onClick={() => navigate("/plan")}>Открыть план</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <Card className="p-3">
              <h3 className="font-medium mb-2">Утро</h3>
              {savedPlan.morning?.length ? (
                <ul className="list-disc list-inside space-y-1">
                  {savedPlan.morning.slice(0, 4).map((p, i) => (
                    <li key={`m-${i}`}>{p.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-600">Шаги не найдены</p>
              )}
            </Card>

            <Card className="p-3">
              <h3 className="font-medium mb-2">Вечер</h3>
              {savedPlan.evening?.length ? (
                <ul className="list-disc list-inside space-y-1">
                  {savedPlan.evening.slice(0, 4).map((p, i) => (
                    <li key={`e-${i}`}>{p.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-600">Шаги не найдены</p>
              )}
            </Card>
          </div>

          <div className="mt-4">
            <Button variant="ghost" onClick={() => navigate("/plan")}>
              Перейти к подробному плану
            </Button>
          </div>
        </Card>
      )}

      {!hasAnswers && (
        <Card className="mb-6 p-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium mb-1">Запланируйте свою рутину</h2>
            <p className="text-sm text-neutral-600">Пройдите короткую анкету, и мы соберём персональный уход.</p>
          </div>
          <Link to="/quiz">
            <Button>Заполнить анкету</Button>
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex flex-col">
          <h2 className="text-lg font-medium">Скан по фото</h2>
          <p className="text-sm text-neutral-600 mt-1">
            Загрузите фото — мы подскажем тип кожи и проблемы.
          </p>
          <div className="mt-auto pt-3">
            <Link to="/photo">
              <Button>Перейти к скану</Button>
            </Link>
          </div>
        </Card>

        {savedPlan && (
          <Card className="p-4 flex flex-col">
            <h2 className="text-lg font-medium">Мой план ухода</h2>
            <p className="text-sm text-neutral-600 mt-1">
              Посмотреть рекомендации и расписание на 28 дней.
            </p>
            <div className="mt-auto pt-3">
              <Link to="/plan">
                <Button variant="secondary">Открыть план</Button>
              </Link>
            </div>
          </Card>
        )}

        <Card className="p-4 flex flex-col">
          <h2 className="text-lg font-medium">Корзина</h2>
          <p className="text-sm text-neutral-600 mt-1">
            Товары из плана, которые вы добавили.
          </p>
          <div className="mt-auto pt-3">
            <Link to="/cart">
              <Button variant="ghost">Перейти в корзину</Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* нижний CTA больше не нужен, т.к. есть верхний промо-блок */}
    </div>
  );
}

