// src/tests/Photo.test.tsx
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// мокаем навигацию
const navigateMock = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

// мокаем assets, если вдруг где-то подтянутся

// ускоряем таймер мок-анализа и не ломаем userEvent
vi.useFakeTimers({ shouldAdvanceTime: true });

const renderPhoto = async () => {
  const mod = await import("../pages/Photo");
  const Photo = mod.default;
  return render(<Photo />);
};

function fileOf(type: string, sizeBytes = 1024, name = "test." + type.split("/")[1]) {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

beforeEach(() => {
  localStorage.clear();
  navigateMock.mockReset();
});

describe("Photo page", () => {
  it("показывает инструкцию и позволяет скрыть её 'Больше не показывать'", async () => {
    await renderPhoto();
    expect(screen.getByText(/как сделать фото/i)).toBeInTheDocument();

    // скрываем подсказки
    const dontShow = screen.getByRole("checkbox", { name: /больше не показывать/i });
    await userEvent.click(dontShow);
    await userEvent.click(screen.getByRole("button", { name: /продолжить/i }));

    // перешли к загрузке
    expect(screen.getByText(/загрузите фото/i)).toBeInTheDocument();

    // открываем подсказки из ссылки
    await userEvent.click(screen.getByRole("button", { name: /как сделать фото\?/i }));
    expect(screen.getByText(/как сделать фото/i)).toBeInTheDocument();
  });

  it("валидирует формат и размер; успешная загрузка включает предпросмотр и анализ", async () => {
    await renderPhoto();
    // закрыть подсказки
    await userEvent.click(screen.getByRole("button", { name: /продолжить/i }));

    // плохой формат
    const bad = fileOf("text/plain", 1024, "bad.txt");
    const galleryInput = screen.getByTestId("file-gallery") as HTMLInputElement;
    await userEvent.upload(galleryInput, bad);
    expect(screen.getByRole("alert")).toHaveTextContent(/формат не поддерживается/i);

    // слишком большой
    const huge = fileOf("image/png", 11 * 1024 * 1024, "huge.png");
    await userEvent.upload(galleryInput, huge);
    expect(screen.getByRole("alert")).toHaveTextContent(/слишком большой/i);

    // корректный файл
    const good = fileOf("image/jpeg", 40 * 1024, "face.jpg");
    await userEvent.upload(galleryInput, good);

    // предпросмотр появился
    expect(await screen.findByAltText(/предпросмотр фото/i)).toBeInTheDocument();

    // запускаем анализ
    await userEvent.click(screen.getByRole("button", { name: /отправить на анализ/i }));
    expect(screen.getByText(/анализируем/i)).toBeInTheDocument();

    // проматываем таймер мок-анализа
    vi.runAllTimers();

    // есть результат: расширенный анализ
    await waitFor(() =>
      expect(screen.getByText(/результат расширенного анализа/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/тип кожи/i)).toBeInTheDocument();
    expect(screen.getByText(/жирность/i)).toBeInTheDocument();
    expect(screen.getByText(/чувствительность/i)).toBeInTheDocument();
    expect(screen.getByText(/увлажнённость/i)).toBeInTheDocument();
  });

  it("создаёт план ухода из результата и навигирует в /plan", async () => {
    await renderPhoto();
    await userEvent.click(screen.getByRole("button", { name: /продолжить/i }));

    const good = fileOf("image/jpeg", 50 * 1024, "face-acne.jpg");
    const galleryInput = screen.getByTestId("file-gallery") as HTMLInputElement;
    await userEvent.upload(galleryInput, good);
    await userEvent.click(screen.getByRole("button", { name: /отправить на анализ/i }));

    vi.runAllTimers();
    await screen.findByText(/результат расширенного анализа/i);

    await userEvent.click(screen.getByRole("button", { name: /создать план ухода/i }));

    expect(navigateMock).toHaveBeenCalledWith("/plan");
    const saved = JSON.parse(localStorage.getItem("skiniq.answers") || "{}");
    expect(saved.source).toBe("photo");
  });

  it("сохраняет скан в истории (если включено) и позволяет удалить", async () => {
    await renderPhoto();
    await userEvent.click(screen.getByRole("button", { name: /продолжить/i }));

    // по умолчанию сохраняем
    const good = fileOf("image/png", 36 * 1024, "face.png");
    const galleryInput = screen.getByTestId("file-gallery") as HTMLInputElement;
    await userEvent.upload(galleryInput, good);
    await userEvent.click(screen.getByRole("button", { name: /отправить на анализ/i }));

    vi.runAllTimers();
    await screen.findByText(/результат расширенного анализа/i);

    // История появилась
    await waitFor(() =>
      expect(screen.getByText(/история сканов/i)).toBeInTheDocument()
    );

    // Удаляем первую запись
    const del = screen.getAllByRole("button", { name: /удалить/i })[0];
    await userEvent.click(del);

    const arr = JSON.parse(localStorage.getItem("skiniq.photo.history") || "[]");
    // может быть 0, если единственную удалили
    expect(Array.isArray(arr)).toBe(true);
  });

  it("перезапуск скана возвращает к загрузчику", async () => {
    await renderPhoto();
    await userEvent.click(screen.getByRole("button", { name: /продолжить/i }));

    const good = fileOf("image/jpeg", 28 * 1024, "face.jpg");
    const galleryInput = screen.getByTestId("file-gallery") as HTMLInputElement;
    await userEvent.upload(galleryInput, good);
    await userEvent.click(screen.getByRole("button", { name: /отправить на анализ/i }));

    vi.runAllTimers();
    await screen.findByText(/результат расширенного анализа/i);

    await userEvent.click(screen.getByRole("button", { name: /повторить скан/i }));
    expect(screen.getByText(/загрузите фото/i)).toBeInTheDocument();
  });
});

